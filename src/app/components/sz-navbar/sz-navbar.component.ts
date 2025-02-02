import { Component, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { Store } from "@ngrx/store";
import { AppState } from "@core/core.state";
import { Observable } from "rxjs";
import { UserManager } from "../../iotlogiq/public-api";
import { IStateController, UserService } from "@core/public-api";
import { WidgetContext } from "@modules/home/models/widget-component.models";
import { UserInfo } from "@shared/public-api";
import { setUser } from "../../iotlogiq/user-manager/actions/user-manager.actions";
import { UserManagerState } from "../../iotlogiq/user-manager/reducers/user-manager.reducer";
import { NavOption } from "./sz-navbar.types";

@Component({
    selector: 'tb-sz-navbar',
    templateUrl: './sz-navbar.component.html',
    styleUrls: ['./sz-navbar.component.scss']
}) 
export class SZNavbarComponent implements OnInit, OnChanges {
    @Input() ctx: WidgetContext;
    mobile: boolean;
    store: Store<AppState & UserManagerState>;
    userService: UserService;
    user$: Observable<UserInfo>;
    userManager: UserManager;
    userState$: Observable<UserInfo>;
    stateController: IStateController;
    activeDashboard: NavOption;
    constructor(
        store: Store<AppState & UserManagerState>,
        userService: UserService
    ) {
        this.store = store;
        this.userService = userService;
    };
    ngOnInit(): void {
        this.activeDashboard = "overview";
        // TO DO: this active dashboard variable should be in
        // an NgRx store or on stateParams, so that other
        // widgets have access to it
        this.stateController = this.ctx.stateController;
        this.userManager = new UserManager(this.userService);
        this.user$ = this.userManager.loadFromAuthUser(this.ctx.currentUser);
        this.userState$ = this.store.select("user");
        this.user$.subscribe((userInfo) => {
            this.store.dispatch(
                setUser({user: userInfo})
            );
            const params = this.stateController.getStateParams();
            const updatedState = {
                ...params,
                user: userInfo
            };
            this.stateController.updateState(
                this.stateController.getStateId(),
                updatedState
            );
        });
        console.log(">>> 💚 about to set mobile from settings", this.ctx.settings, this);
        this.mobile = this.ctx.settings.mobile;
    };
    ngOnChanges(changes: SimpleChanges): void {
        console.log('>>> 💛 changes?', changes);
    };
    navigateToDashboard(dashboardName: NavOption) {
        // update store or state params??
        this.activeDashboard = dashboardName;
    }
};
