import { NgModule } from "@angular/core";
import { SZNavbarComponent } from "./szNavbar.component";
import { IconModule } from "../../modules/public-api";
import { CommonModule } from "@angular/common";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";

@NgModule({
    declarations: [SZNavbarComponent],
    imports: [
        MatIconModule,
        IconModule,
        CommonModule,
        MatToolbarModule
    ],
    exports: [
        SZNavbarComponent
    ]
})
export class SZNavbarModule {};
