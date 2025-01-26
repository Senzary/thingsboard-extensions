import { Component, Input, OnInit } from "@angular/core";
import { FormBuilder, FormGroup } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { AppState } from "@app/core/core.state";
import { WidgetContext } from "@app/modules/home/models/widget-component.models";
import { PageComponent } from "@shared/public-api";
import { Store } from "@ngrx/store";

@Component({
    selector: 'tb-create-customer-form',
    templateUrl: './createCustomerForm.component.html',
    styleUrls: []
})
export class CreateCustomerFormComponent extends PageComponent implements OnInit {
    @Input() ctx: WidgetContext;
    @Input() dialogRef: MatDialogRef<typeof this>;
    public createCustomerFormGroup: FormGroup;

    constructor(
        store: Store<AppState>,
        private fb: FormBuilder
    ) {
        super(store);
    }
    ngOnInit(): void {
        console.log('>>> 💜 inside form, init..', this.ctx);
        this.createCustomerFormGroup = this.fb.group({
            hello: ['', []]
        });
    }
    cancel() {};
};
