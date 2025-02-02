import { NgModule } from "@angular/core";
import { SZNavbarComponent } from "./sz-navbar.component";
import { IconModule } from "../../modules/public-api";
import { CommonModule } from "@angular/common";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { SZNavbarSettingsComponent } from "./sz-navbar-settings.component";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { SharedModule } from "@shared/public-api";
import { WidgetConfigComponentsModule, WidgetSettingsCommonModule } from "@home/components/public-api";

@NgModule({
    declarations: [
        SZNavbarComponent,
        SZNavbarSettingsComponent
    ],
    imports: [
        WidgetSettingsCommonModule,
        WidgetConfigComponentsModule,
        MatIconModule,
        MatButtonModule,
        IconModule,
        CommonModule,
        MatToolbarModule,
        MatSlideToggleModule,
        SharedModule,
    ],
    exports: [
        SZNavbarComponent,
        SZNavbarSettingsComponent
    ]
})
export class SZNavbarModule {};
