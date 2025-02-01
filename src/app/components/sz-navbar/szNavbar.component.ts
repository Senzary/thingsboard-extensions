import { Component, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { Store } from "@ngrx/store";
import { AppState } from "@core/core.state";
import { BreakpointObserver, BreakpointState } from "@angular/cdk/layout";
import { Observable, of } from "rxjs";
import { UserManager } from "../../iotlogiq/public-api";
import { UserService } from "@core/public-api";
import { WidgetContext } from "@modules/home/models/widget-component.models";
import { UserInfo } from "@shared/public-api";
import { setUser } from "../../iotlogiq/user-manager/actions/user-manager.actions";
import { UserManagerState } from "../../iotlogiq/user-manager/reducers/user-manager.reducer";

@Component({
    selector: 'tb-sz-navbar',
    templateUrl: './szNavbar.component.html',
    styleUrls: ['./szNavbar.component.scss']
}) 
export class SZNavbarComponent implements OnInit, OnChanges {
    @Input() ctx: WidgetContext;
    store: Store<AppState & UserManagerState>;
    notMobile$: Observable<BreakpointState>;
    userService: UserService;
    user$: Observable<UserInfo>;
    userManager: UserManager;
    userState$: Observable<UserInfo>;
    constructor(
        store: Store<AppState & UserManagerState>,
        private breakpointObserver: BreakpointObserver,
        userService: UserService
    ) {
        this.store = store;
        this.userService = userService;
        this.notMobile$ = this.breakpointObserver.observe([
            "xl",
            "lg",
            "md"
        ]);
    };
    ngOnInit(): void {
        this.userManager = new UserManager(this.userService);
        this.user$ = this.userManager.loadFromAuthUser(this.ctx.currentUser);
        this.userState$ = this.store.select("user");
        this.user$.subscribe((userInfo) => {
            console.log('>>> 💙 triggering?');
            this.store.dispatch(
                setUser({user: userInfo})
            );
        });
    };
    ngOnChanges(changes: SimpleChanges): void {
        console.log('>>> 💛', changes);
    }
};
