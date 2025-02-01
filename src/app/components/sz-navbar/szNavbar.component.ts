import { Component, Input, OnInit } from "@angular/core";
import { Store } from "@ngrx/store";
import { AppState } from "@core/core.state";
import { BreakpointObserver, BreakpointState } from "@angular/cdk/layout";
import { Observable, of } from "rxjs";
import { OrganisationUser } from "../../sz-models/public-api";
import { UserService } from "@core/public-api";
import { WidgetContext } from "@modules/home/models/widget-component.models";
import { UserInfo } from "@shared/public-api";

@Component({
    selector: 'tb-sz-navbar',
    templateUrl: './szNavbar.component.html',
    styleUrls: ['./szNavbar.component.scss']
}) 
export class SZNavbarComponent implements OnInit {
    @Input() ctx: WidgetContext;
    store: Store<AppState>;
    notMobile$: Observable<BreakpointState>;
    userService: UserService;
    user$: Observable<UserInfo>;
    userManager: OrganisationUser;
    constructor(
        store: Store<AppState>,
        private breakpointObserver: BreakpointObserver,
        userService: UserService
    ) {
        this.userService = userService;
        this.notMobile$ = this.breakpointObserver.observe([
            "xl",
            "lg",
            "md"
        ]);
    };
    ngOnInit(): void {
        this.userManager = new OrganisationUser(this.userService);
        this.user$ = this.userManager.loadFromAuthUser(this.ctx.currentUser);
    };
};
