import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { WidgetAction, WidgetContext } from '../../models/widget-component.models';
import { FlatTreeControl } from '@angular/cdk/tree';
import {
    Authority,
    Customer,
    EntityGroupInfo,
    EntityType,
    PageComponent,
    WidgetConfig,
    WidgetSettings
} from '@shared/public-api';
import { AppState, CustomerService, EntityGroupService, IWidgetSubscription } from '@core/public-api';
import { Store } from '@ngrx/store';
import { concatMap, filter, forkJoin, from, groupBy, map, mergeMap, Observable, of, switchMap, toArray } from 'rxjs';
import { CurrentUser } from '../../models/widget-component.models';
import {
    EntityNode,
    FlatNode,
    IEntityGroupsDictionary,
    IEntityInfoWithChildren,
    IEntityNode
} from './hierarchyTree.models';
import { Breadcrumbs, IBreadcrumb } from '../breadcrumbs/breadcrumbs.models';

const SenzaryCustomerName = 'Senzary Tenant Customer';

/**
 * @title Flat Tree (treeControl)
 */
@Component({
    selector: 'tb-hierarchy-tree',
    templateUrl: './hierarchyTree.component.html',
    styleUrls: ['./hierarchyTree.component.scss']
})
export class HierarchyTreeComponent extends PageComponent implements OnInit {
    @Input() ctx: WidgetContext;
    private _settings: WidgetSettings;
    private _widgetConfig: WidgetConfig;
    private _subscription: IWidgetSubscription;
    private _transformer = (node: IEntityNode, level: number): FlatNode => ({
        expandable: !!node.children,
        name: node.name,
        disabled: node.children?.length < 1,
        entityId: node.entityId,
        level: level,
        group: node.group
    });
    private createCustomerAction: WidgetAction = {
        name: 'create customer',
        show: true,
        icon: 'add_circle_outline',
        onAction: ($event) => {
            this.openCustomerForm('create');
        }
    };
    private blockAll = false;
    public breadcrumbs = new Breadcrumbs<Customer>();
    public selectedCustomer: Customer;
    public treeControl = new FlatTreeControl<FlatNode>(
        (node) => node.level,
        (node) => node.expandable
    );
    public treeFlattener = new MatTreeFlattener(
        this._transformer,
        node => node.level,
        node => node.expandable,
        node => node.children
    );
    public dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
    constructor(
        protected store: Store<AppState>,
        private customerService: CustomerService,
        private entityGroupService: EntityGroupService,
        private changeDetection: ChangeDetectorRef
    ) {
        super(store);
        // this.customerService = customerService;
        // this.entityGroupService = entityGroupService;
        // this.changeDetection = changeDetection
    }
    ngOnInit() {
        this.ctx.$scope.hierarchyTreeComponent = this;
        this.configWidget(this.ctx.widgetConfig);
        this.ctx.widgetActions = [this.createCustomerAction];
        this._settings = this.ctx.settings;
        this._subscription = this.ctx.defaultSubscription;
        const user = this.ctx.currentUser;
        const userCustomerObservable = this.getUserCustomer(user);
        this.refreshWidgetForCustomer(userCustomerObservable);
    }
    configWidget(config: WidgetConfig) {
        this._widgetConfig = config;
        this._widgetConfig.backgroundColor = '#3D3B83';
        this._widgetConfig.borderRadius = '0.5rem';
        this._widgetConfig.color = '#FFF';
    }
    refreshWidgetForCustomer(
        customerObservable: Observable<Customer>,
        refreshBreadcrumbs: boolean=true
    ) {
        if (this.blockAll) return;
        this.blockAll = true;
        const groupsObservable = this.getCustomerGroups(customerObservable);
        const parsedGroupsObservable = this.parseCustomerGroups(
            groupsObservable
        );
        parsedGroupsObservable.subscribe((customerGroupsDictionary) => {
            this.updateNodesForDataSource(this.selectedCustomer, customerGroupsDictionary);
            if (refreshBreadcrumbs) this.updateBreadcrumbs(this.selectedCustomer);
            this.updateCurrentCustomerState(this.selectedCustomer);
            this.ctx.updateWidgetParams();
            this.ctx.updateAliases();
            this.blockAll = false;
        });
    }
    openCustomerForm(mode: 'create' | 'edit') {
        console.log('>>> 💚 what do we do here?');
    };
    getSenzaryCustomer(): Observable<Customer> {
        const pageLink = this.ctx.pageLink(10, 0, SenzaryCustomerName);
        return this.customerService.getCustomers(pageLink).pipe(
            map((response) => response.data[0])
        );
    }
    getUserCustomer(user: CurrentUser): Observable<Customer> {
        let customerIdObservable = of(user.customerId);
        if (user.authority !== Authority.CUSTOMER_USER) {
            customerIdObservable = this.getSenzaryCustomer().pipe(
                map((customer) => customer.id.id)
            );
        }
        return customerIdObservable.pipe(
            switchMap((customerId) => this.customerService
                .getCustomer(customerId)
        ));
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
    updateNodesForDataSource(
        customer: Customer,
        customerGroups: IEntityGroupsDictionary
    ) {
        // find customer's node in current datasource
        const customerNode = this.dataSource.data.find((node) => node.name === customer.name);
        // parse customerGroups into IEntityNodes
        const groups: IEntityInfoWithChildren[] = [];
        for (const [groupName, entityGroupWithChildren] of Object.entries(customerGroups)) {
            groups.push(entityGroupWithChildren);
        }
        // update datasource
        if (!customerNode) {
            this.dataSource.data = groups.map((g) => new EntityNode(g));
        } else {
            customerNode.setChildren(groups);
            this.dataSource.data = [customerNode];
        }
    };
    updateBreadcrumbs(newCustomer: Customer) {
        this.breadcrumbs.addItem(newCustomer);
        this.changeDetection.detectChanges();
    }
    updateCurrentCustomerState(customer: Customer) {
        const params = this.ctx.stateController.getStateParams();
        const newState: typeof params = {};
        newState.currentCustomer = {
            entityId: customer.id,
            entityName: customer.name,
            entityLabel: customer.label
        };
        this.ctx.stateController.updateState(
            this.ctx.stateController.getStateId(),
            newState
        );
    }
    selectCustomerAndUpdateTree(node: FlatNode) {
        // figure out chosen customer
        const customerId = node.entityId.id;
        // fetch this customer's groups and group entities
        this.refreshWidgetForCustomer(
            this.customerService.getCustomer(customerId)
        );
    }
    downgradeToExistingNode(customer: Customer) {
        this.refreshWidgetForCustomer(of(customer), false);
    }
    public breadcrumbCallback(breadcrumbItem: IBreadcrumb<Customer>) {
        const activeItem = this.breadcrumbs.active;
        if (breadcrumbItem.id === activeItem.id) return;
        // this.currentPathItems = this.breadcrumbs.jumpTo(breadcrumbItem);
        this.breadcrumbs.jumpTo(breadcrumbItem);
        this.changeDetection.detectChanges();
        // re render right nodes on tree
        this.downgradeToExistingNode(breadcrumbItem.data);
    }
    hasChild = (_: number, node: FlatNode) => node.expandable;
}
