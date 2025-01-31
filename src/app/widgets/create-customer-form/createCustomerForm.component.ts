import { Component, Input, OnInit } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { AppState } from "@app/core/core.state";
import { WidgetContext } from "@app/modules/home/models/widget-component.models";
import { CustomerInfo, PageComponent } from "@shared/public-api";
import { Store } from "@ngrx/store";
import { camelToHuman, COMPANY_HIERARCHIES, CompanyHierarchy, FormField, getCustomerCustomers, getCustomerHierarchy, getUserCustomerInfo, getUserCustomerInfos, SZDropdownItem, ZIP_CODE_PATTERNS } from "../../utils/public-api";
import { concatMap, filter, forkJoin, from, map, mergeMap, of, Subscription, switchMap, tap, toArray } from "rxjs";
import { CustomerService, EntityGroupService } from "@core/public-api";

interface OrganisationWitHierarchies {
    organisation: CustomerInfo;
    hierarchies: SZDropdownItem<CompanyHierarchy>[];
};

@Component({
    selector: 'tb-create-customer-form',
    templateUrl: './createCustomerForm.component.html',
    styleUrls: []
})
export class CreateCustomerFormComponent extends PageComponent implements OnInit {
    @Input() ctx: WidgetContext;
    @Input() dialogRef: MatDialogRef<typeof this>;
    customerService: CustomerService;
    entityGroupService: EntityGroupService;
    private subscriptions: Subscription[] = [];
    parentOrganisationFormSubscription: Subscription;
    hierarchyObservableFormSubscription: Subscription;
    public fields: FormField[];
    public parentOrganisationOptions: SZDropdownItem<CustomerInfo>[];
    public companyHierarchyOptions: SZDropdownItem<CompanyHierarchy>[];
    public createCustomerFormGroup: FormGroup;

    public organisationsAndHierarchies: OrganisationWitHierarchies[];
    orgsAndHierarchiesSubscription: Subscription;

    constructor(
        store: Store<AppState>,
        private fb: FormBuilder,
        customerService: CustomerService,
        entityGroupService: EntityGroupService
    ) { 
        super(store); 
        this.fb = fb;
        this.customerService = customerService;
        this.entityGroupService = entityGroupService;
    }
    ngOnInit(): void {
        // TO DO: create interfaces for this forms 
        // how about a model, the organisation model
        // it should be able to deliver arrays for
        // fields
        // TO DO: split form in 2 steps id & contact 
        // TO DO: split into functions; setUpForm
        this.createCustomerFormGroup = this.fb.group({
            parentOrganisation: [null, []],
            title: ["", [Validators.required, Validators.maxLength(255)]],
            hierarchy: [null, [Validators.required]],
            country: ["", []],
            city: ["", []],
            state: ["", []],
            zip: ["", this.getZipCodeValidators()],
            address: ["", []],
            address2: ["", []],
            phone: ["", []],
            email: ["", [Validators.email]]
        });
        this.parentOrganisationFormSubscription = this.createCustomerFormGroup
            .get('parentOrganisation')
            .valueChanges
            .subscribe((chosenParentOrganisation) => this.onParentOrganisationChange(
                chosenParentOrganisation
            ));
        this.subscriptions.push(this.parentOrganisationFormSubscription);
        // TO DO split into function build fields
        // TO DO check if it makes sense to build a formfields 
        // generic interface to type fields 
        this.fields = Object.entries(
            this.createCustomerFormGroup.controls
        ).filter(
            ([name, control]) => [
                "parentOrganisation",
                "title",
                "hierarchy",
            ].includes(name)
        ).map(([name, control]) => {
            const field: FormField = { 
                name: name,
                label: camelToHuman(name),
                required: ["title", "hierarchy"].includes(name),
                input: name === "title" ? "input" : "select"
            };
            if (field.input === "select") field.enumOptions = [];
            return field;
        });
        console.log(">>> 💛 just added fields:", this.fields);
        // get user customer's customers to store organisations and 
        // hierarchies available for each one according to its own
        // hierarchy (based on group they belong to)
        // TO DO split this into function; setUpData
        this.orgsAndHierarchiesSubscription = getUserCustomerInfo(
            this.ctx,
            this.customerService
        ).pipe(
            switchMap((customerInfo) => {
                const observable = getCustomerCustomers(
                    of(customerInfo),
                    this.ctx,
                    this.customerService
                );
                return forkJoin<[CustomerInfo, CustomerInfo[]]>([
                    of(customerInfo),
                    observable
                ]); 
            }),
            mergeMap(([customerInfo, infos]) => {
                return from([customerInfo, ...infos]);
            }),
            concatMap((info) => forkJoin([
                of(info),
                getCustomerHierarchy(
                    info,
                    this.entityGroupService
                )
            ])),
            filter(([info, hierarchy]) => !!hierarchy && hierarchy in COMPANY_HIERARCHIES), 
            map(([info, hierarchy]) => {
                const organisationWithHierarchies: OrganisationWitHierarchies = {
                    organisation: info,
                    hierarchies: COMPANY_HIERARCHIES[hierarchy].mayHave.map(
                        h => ({
                            label: COMPANY_HIERARCHIES[h].label,
                            value: h
                        })
                    )
                };
                return organisationWithHierarchies;
            }),
            toArray()
        ).subscribe((orgsWithHierarchies) => {
            this.organisationsAndHierarchies = orgsWithHierarchies;
            this.fields = this.fields.map((field) => {
                if (field.name === "parentOrganisation") {
                    field.selectOptions = orgsWithHierarchies.map(
                        (o) => ({
                            label: o.organisation.title,
                            value: o.organisation
                        })
                    );
                }
                return field
            });
            if (!this.createCustomerFormGroup) return;
            this.createCustomerFormGroup
                .get('parentOrganisation')
                .setValue(this.organisationsAndHierarchies[0].organisation);
            console.log('>>> 🖤 orgs with hs', this.organisationsAndHierarchies);
        });
    }
    onParentOrganisationChange(parentOrganisation: CustomerInfo): void {
        // find chosen org in this.organizationsAndHierarchies array
        const chosenOrganisation = this.organisationsAndHierarchies
            .find(
                (organisationWithHierarchies) => organisationWithHierarchies
                    .organisation.name === parentOrganisation.name
        );
        if (!chosenOrganisation) return;
        this.fields = this.fields.map((field) => {
            if (field.name === "hierarchy") field
                .selectOptions = chosenOrganisation.hierarchies;
            return field;
        });
        if (!this.createCustomerFormGroup) return;
        this.createCustomerFormGroup
            .get('hierarchy')
            .setValue(chosenOrganisation.hierarchies[0].value);
    };
    getZipCodeValidators(): ValidatorFn[] {
        const patternValidator = function(control: FormControl) {
            if (!control.parent) return [];
            const parentValues = control.parent.value;
            const country = parentValues.country;
            return [Validators.pattern(ZIP_CODE_PATTERNS[country])];
        };
        return [patternValidator];
    };
    cancel() {
        this.subscriptions.forEach((subscription) => subscription.unsubscribe());
        this.ctx.updateWidgetParams();
        this.dialogRef.close();
    };
    save() {

    }
};
