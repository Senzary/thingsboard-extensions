import { Component, Input, OnInit } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { AppState } from "@app/core/core.state";
import { WidgetContext } from "@app/modules/home/models/widget-component.models";
import { CustomerInfo, PageComponent } from "@shared/public-api";
import { Store } from "@ngrx/store";
import { camelToHuman, COMPANY_HIERARCHIES, CompanyHierarchy, FormField, getCustomerHierarchy, getUserCustomerInfo, getUserCustomerInfos, SZDropdownItem, ZIP_CODE_PATTERNS } from "../../utils/public-api";
import { forkJoin, map, Subscription, tap } from "rxjs";
import { CustomerService, EntityGroupService } from "@core/public-api";

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
    public fields: FormField[];
    public parentOrganisationOptions: SZDropdownItem<CustomerInfo>[];
    public companyHierarchyOptions: SZDropdownItem<CompanyHierarchy>[];
    public createCustomerFormGroup: FormGroup;

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
        console.log('>>> 💜 inside form, init..', this.ctx);
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
        const parentOrganisationFormSubscription = this.createCustomerFormGroup
            .get('parentOrganisation')
            .valueChanges
            .subscribe((chosenParentOrganisation) => this.onParentOrganisationChange(
                chosenParentOrganisation
            ));
        this.subscriptions.push(parentOrganisationFormSubscription);
        console.log(">>> 💚 just added fields:", this.fields);
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
        // get user customer's customers to fill the dropdown 
        // list for parent customer input
        const customerInfosObservable = getUserCustomerInfos(
            this.ctx, 
            this.customerService
        );
        const userCustomerInfoObservable = getUserCustomerInfo(
            this.ctx,
            this.customerService
        );
        const parentOrganisationOptionsObservable = forkJoin([
            userCustomerInfoObservable,
            customerInfosObservable
        ]).pipe(
            map(([customerInfo, infos]) => {
                return [customerInfo, ...infos];
            }),
            tap((customers) => {
                // fill out parent customer dropdown
                const parentOrganisationField = this.fields
                    .find((field) => field.name === "parentOrganisation");
                if (!!parentOrganisationField) {
                    parentOrganisationField.selectOptions = customers.map(
                        (customer) => ({
                            label: customer.name,
                            value: customer
                        })
                    ); 
                }
                if (!this.createCustomerFormGroup) return;
                console.log('>>> 💛 customers, organisations:', customers);
                this.createCustomerFormGroup
                    .get('parentOrganisation')
                    .setValue(customers[0]);
            })
        );
        this.subscriptions.push(
            parentOrganisationOptionsObservable.subscribe()
        );
    }
    onParentOrganisationChange(parentOrganisation: CustomerInfo): void {
        // figure out chosen customer hierarchy to prepare 
        // company hierarchy select options
        const hierarchyObservable = getCustomerHierarchy(
            parentOrganisation,
            this.entityGroupService
        ).pipe(
            // fill out hierarchy dropdown based on parent 
            // customer hierarchy
            tap((hierarchy) => {
                const hierarchyField = this.fields
                    .find((field) => field.name === "hierarchy");
                if (!hierarchy) {
                    hierarchyField.selectOptions = [];
                    return;
                }
                const options = COMPANY_HIERARCHIES[hierarchy]
                    .mayHave;
                hierarchyField.selectOptions = options.map(
                    (option) => ({
                        label: COMPANY_HIERARCHIES[option].label,
                        value: option
                    })
                );
                if (!this.createCustomerFormGroup) return;
                this.createCustomerFormGroup
                    .get('hierarchy')
                    .setValue(this.companyHierarchyOptions[0]);
            })
        );
        this.subscriptions.push(hierarchyObservable.subscribe());
    }
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
