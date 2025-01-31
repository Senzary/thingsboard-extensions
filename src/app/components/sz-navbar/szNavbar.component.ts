import { Component } from "@angular/core";
import { Store } from "@ngrx/store";
import { AppState } from "@core/core.state";

@Component({
    selector: 'tb-sz-navbar',
    templateUrl: './szNavbar.component.html',
    styleUrls: ['./szNavbar.component.scss']
}) 
export class SZNavbarComponent {
    store: Store<AppState>;
    constructor(
        store: Store<AppState>
    ) {
        this.store = store;
    };
};
