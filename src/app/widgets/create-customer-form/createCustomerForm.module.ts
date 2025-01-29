import { NgModule } from "@angular/core";
import { CreateCustomerFormComponent } from "./createCustomerForm.component";
import { MatDialogModule } from "@angular/material/dialog";
import { CommonModule, NgClass } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { SharedModule } from "@shared/public-api";
import { SZFormFieldsetModule } from "../../components/sz-form-field-set/public-api";

@NgModule({
    declarations: [CreateCustomerFormComponent],
    imports: [
        NgClass,
        SharedModule,
        CommonModule,
        SZFormFieldsetModule
    ],
    exports: [
        CreateCustomerFormComponent
    ]
})
export class CreateCustomerFormModule {};
