import { NgModule } from "@angular/core";
import { SZNavbarComponent } from "./szNavbar.component";
import { IconModule } from "../../modules/public-api";
import { CommonModule } from "@angular/common";
import { MatToolbarModule } from "@angular/material/toolbar";

@NgModule({
    declarations: [SZNavbarComponent],
    imports: [
        IconModule,
        CommonModule,
        MatToolbarModule
    ],
    exports: [
        SZNavbarComponent
    ]
})
export class SZNavbarModule {};
