import { NgModule } from "@angular/core";
import { SZFormFiedsetComponent } from "./szFormFieldset.component";
import { SharedModule } from "@shared/public-api";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { CommonModule, NgClass } from "@angular/common";

@NgModule({
    declarations: [SZFormFiedsetComponent],
    imports: [
        NgClass,
        SharedModule, 
        MatFormFieldModule, 
        CommonModule,
        MatInputModule
    ],
    exports: [SZFormFiedsetComponent]
})
export class SZFormFieldsetModule {};
