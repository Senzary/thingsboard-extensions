import { NgModule } from "@angular/core";
import { CreateCustomerFormComponent } from "./createCustomerForm.component";
import { MatDialogModule } from "@angular/material/dialog";
import { CommonModule, NgClass } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { SharedModule } from "@shared/public-api";

@NgModule({
    declarations: [CreateCustomerFormComponent],
    imports: [
        NgClass,
        MatDialogModule,
        CommonModule,
        MatButtonModule,
        SharedModule
    ],
    exports: [
        CreateCustomerFormComponent
    ]
})
export class CreateCustomerFormModule {};
