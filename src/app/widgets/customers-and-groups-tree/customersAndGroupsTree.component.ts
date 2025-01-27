import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState, CustomerService, DialogService, EntityGroupService } from '@core/public-api';
import { AuthUser, Customer, EntityGroupInfo, EntityType, WidgetConfig } from '@shared/public-api';
import { WidgetAction, WidgetContext } from '@app/modules/home/models/widget-component.models';
import { Breadcrumbs, IBreadcrumb } from '../../components/breadcrumbs/breadcrumbs.models';
import { EntityNode, IEntityGroupsDictionary, IEntityInfoWithChildren, IEntityNode } from '../../components/hierarchy-tree/hierarchyTree.models';
import { concatMap, forkJoin, from, map, mergeMap, Observable, of, Subscription, switchMap, tap, toArray } from 'rxjs';
import { HierarchyTreeComponent } from '../../components/hierarchy-tree/public-api'
import { CreateCustomerFormComponent } from '../create-customer-form/createCustomerForm.component';
import { getUserCustomer, doesUserBelongToAdminGroup, AssetManagementDashboardStateParams } from '../../utils/public-api';

// const SENZARY_CUSTOMER_NAME = 'Senzary Tenant Customer';

@Component({
    selector: 'tb-customers-and-groups-tree',
    templateUrl: './customersAndGroupsTree.component.html',
    styleUrls: [
        './customersAndGroupsTree.component.scss',
        '../../components/hierarchy-tree/hierarchyTree.component.scss'
    ]
})
export class CustomersAndGroupsTreeComponent extends HierarchyTreeComponent<Customer> implements OnInit {
    @Input() ctx: WidgetContext;
    private _widgetConfig;
    private customerService: CustomerService;
    private entityGroupService: EntityGroupService;
    private customDialogService: DialogService;
    private createCustomerAction: WidgetAction = {
        name: 'action.create-customer',
        show: true,
        icon: 'add_business',
        onAction: ($event) => {
            this.openCustomerForm('create');
        },
        
    };
    private refreshing = false;
    private subscriptions: Subscription[];
    breadcrumbs = new Breadcrumbs<Customer>();
    selectedCustomer: Customer;
    nodes: IEntityNode[] = [];
    constructor(
        protected store: Store<AppState>,
        changeDetection: ChangeDetectorRef,
        customerService: CustomerService,
        entityGroupService: EntityGroupService,
        customDialogService: DialogService
    ) { 
        super(store, changeDetection);
        this.customerService = customerService;
        this.entityGroupService = entityGroupService;
        this.customDialogService = customDialogService; 
    };
    ngOnInit(): void {
        console.log('>>> initializint widget');
        // this.ctx.$scope.tree = this;
        this.configWidget(this.ctx.widgetConfig);
        // this._settings = this.ctx.settings;
        // this._subscription = this.ctx.defaultSubscription;
        const user = this.ctx.currentUser;
        const userCustomerObservable = getUserCustomer(
            this.customerService,
            this.ctx
        );
        // refresh nodes & breadcrumbs
        this.subscriptions = [];
        this.subscriptions.push(this.setUpActions(user));
        this.subscriptions.push(
            this.refreshWidgetForCustomer(userCustomerObservable)
        );
        console.log('>>> finishing initialization for widget');
    };
    configWidget(config: WidgetConfig) {
        this._widgetConfig = config;
        this._widgetConfig.backgroundColor = '#3D3B83';
        this._widgetConfig.borderRadius = '0.5rem';
        this._widgetConfig.color = '#FFF';
    };
    setUpActions(user: AuthUser): Subscription {
        // get current user user group; if admin, show, otherwise don't
        return doesUserBelongToAdminGroup(
            user.userId,
            this.entityGroupService
        ).pipe(
            tap((userIsAdmin) => {
                if (userIsAdmin) this.ctx.widgetActions = [
                    this.createCustomerAction
                ];
            })
        ).subscribe();
    };
    refreshWidgetForCustomer(
        customerObservable: Observable<Customer>,
        refreshBreadcrumbs: boolean=true
    ): Subscription {
        if (this.refreshing) return;
        this.refreshing = true;
        console.log('>>> refreshing widget');
        // build customer groups dictionary where keys
        // are group names and values are group info
        // with its customers as children property
        const groupsObservable = this.getCustomerGroups(customerObservable);
        const parsedGroupsObservable = this.parseCustomerGroups(
            groupsObservable
        );
        return parsedGroupsObservable.subscribe((customerGroupsDictionary) => {
            this.updateNodesFor(
                this.selectedCustomer, 
                Object.values(customerGroupsDictionary)
            );
            if (refreshBreadcrumbs) this.updateBreadcrumbs(this.selectedCustomer);
            this.updateCurrentCustomerState(this.selectedCustomer);
            this.ctx.updateWidgetParams();
            this.ctx.updateAliases();
            this.refreshing = false;
        });
    };
    updateNodesFor(item: Customer, children: IEntityInfoWithChildren[]): void {
        console.log('>>> bout to ', this.nodes, item, children);
        const customerNode = this.nodes
            .find((node) => node.name === item.name);
        if (!customerNode) {
            // first node, made out of children
            this.nodes = children.map((c) => new EntityNode(c));
            console.log('>>> this is', this.dataSource);
        } else {
            customerNode.setChildren(children);
        }
        this.ctx.detectChanges();
    }
    updateBreadcrumbs(customer: Customer) {
        this.breadcrumbs.addItem(customer);
        this.ctx.detectChanges();
    };
    getCustomerGroups(customerObservable: Observable<Customer>): Observable<EntityGroupInfo[]> {
        return customerObservable.pipe(
            switchMap((customer) => {
                this.selectedCustomer = customer;
                return this.entityGroupService.getEntityGroupsByOwnerId(
                    EntityType.CUSTOMER,
                    this.selectedCustomer.id.id,
                    EntityType.CUSTOMER
                );
            }),
            map((groups) => groups.filter(g => g.name !== 'All'))
        );
    };
    parseCustomerGroups(
        groupsObservable: Observable<EntityGroupInfo[]>
    ): Observable<IEntityGroupsDictionary> {
        const customerGroups: IEntityGroupsDictionary = {};
        return groupsObservable.pipe(
            mergeMap((groups) => from(groups)),
            concatMap((group) => {
                const pageLink = this.ctx.pageLink(150, 0);
                customerGroups[group.name] = group;
                customerGroups[group.name].children = [];
                return forkJoin([
                    this.entityGroupService.getEntityGroupEntities<Customer>(
                        group.id.id,
                        pageLink,
                        EntityType.CUSTOMER
                    ),
                    of(group)
                ]);
            }),
            map(([response, group]) => {
                const entities = response.data;
                customerGroups[group.name].children.push(...entities);
                return entities;
            }),
            toArray(),
            map((response) => customerGroups)
        );
    };
    updateCurrentCustomerState(customer: Customer) {
        const params = this.ctx.stateController.getStateParams();
        const newState: AssetManagementDashboardStateParams = {
            entityId: customer.id,
            entityName: customer.name,
            entityLabel: customer.label,
            currentCustomer: customer
        };
        this.ctx.stateController.updateState(
            this.ctx.stateController.getStateId(),
            newState
        );
    };
    onSelectCustomerBreadcrumb(breadcrumbItem: IBreadcrumb<Customer>) {
        const activeItem = this.breadcrumbs.active;
        if (breadcrumbItem.id === activeItem.id) return;
        // this.currentPathItems = this.breadcrumbs.jumpTo(breadcrumbItem);
        this.breadcrumbs.jumpTo(breadcrumbItem);
        this.ctx.detectChanges();
        // re render right nodes on tree
        const customer = breadcrumbItem.data;
        this.refreshWidgetForCustomer(of(customer), false);
    };
    onSelectCustomerNode(customerNode: IEntityNode) {
        this.clearSubscriptions();
        const costumerObservable = this.customerService
            .getCustomer(customerNode.entityId.id);
        this.subscriptions.push(
            this.refreshWidgetForCustomer(
                costumerObservable
            )
        );
    };
    clearSubscriptions() {
        while (this.subscriptions.length > 0) {
            const subscription = this.subscriptions.pop();
            subscription.unsubscribe();
        }
    };
    openCustomerForm(mode: 'create' | 'edit') {
        console.log('>>> 💚 what do we do here?');
        const dialogRef = this.customDialogService
            .dialog.open(CreateCustomerFormComponent);
        const instance = dialogRef.componentInstance;
        instance.ctx = this.ctx;
        instance.dialogRef = dialogRef;
    };
};
