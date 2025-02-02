import { Component } from "@angular/core";
import { FormBuilder, FormGroup } from "@angular/forms";
import { Store } from "@ngrx/store";
import { AppState } from "@core/core.state";
import { WidgetSettings, WidgetSettingsComponent } from "@shared/public-api";

@Component({
    selector: 'tb-sz-navbar-settings',
    templateUrl: './sz-navbar-settings.component.html',
    styleUrls: []
})
export class SZNavbarSettingsComponent extends WidgetSettingsComponent {
    public szNavbarSettingsForm: FormGroup;
    constructor(
        protected store: Store<AppState>,
        private fb: FormBuilder
    ) { super(store); };
    protected defaultSettings(): WidgetSettings {
        return {
            mobile: true
        };
    };
    protected onSettingsSet(settings: WidgetSettings) {
        this.szNavbarSettingsForm = this.fb.group({
            mobile: [settings.mobile, []]
        });
    };
    protected settingsForm(): FormGroup {
        return this.szNavbarSettingsForm;
    };
};
