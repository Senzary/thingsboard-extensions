import { NgModule } from "@angular/core";
import { SZFormFieldComponent } from "./szFormField.component";
import { SharedModule } from "@shared/public-api";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { NgClass } from "@angular/common";

@NgModule({
    declarations: [SZFormFieldComponent],
    imports: [
        NgClass,
        SharedModule, 
        MatFormFieldModule, 
        MatInputModule
    ],
    exports: [SZFormFieldComponent]
})
export class SZFormFieldModule {};
