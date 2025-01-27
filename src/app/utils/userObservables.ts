import { CustomerService, EntityGroupService } from "@app/core/public-api";
import { WidgetContext } from "@app/modules/home/models/widget-component.models";
import { Authority, Customer, CustomerInfo, EntityType } from "@shared/public-api";
import { map, Observable, of, switchMap } from "rxjs";
import { CompanyHierarchy } from "./types";
import { getCustomerHierarchy, getSenzaryCustomer } from "./customerObservables";

export function getUserCustomer(
    customerService: CustomerService,
    ctx: WidgetContext
): Observable<Customer> {
    const user = ctx.currentUser;  
    let customerIdObservable = of(user.customerId);
    if (user.authority !== Authority.CUSTOMER_USER) {
        customerIdObservable = getSenzaryCustomer(
            customerService, 
            ctx
        ).pipe(
            map((customer) => customer.id.id)
        );
    }
    return customerIdObservable.pipe(
        switchMap((customerId) => customerService
            .getCustomer(customerId)
    ));
};

export function doesUserBelongToAdminGroup(
    userId: string,
    service: EntityGroupService
): Observable<boolean> {
    return service.getEntityGroupIdsForEntityId(
        EntityType.USER,
        userId
    ).pipe(
        switchMap((groups) => service
            .getEntityGroupEntityInfosByIds(
                groups.map(g => g.id)
            )),
        map((groups) => groups
            .some((group) => group.name.toLowerCase()
                .includes('admin')))
    );
};

export function getUserCustomerInfos(
    ctx: WidgetContext,
    service: CustomerService
): Observable<CustomerInfo[]> {
    const pageLink = ctx.pageLink(500,0);
    return service.getAllCustomerInfos(
        true,
        pageLink
    ).pipe(
        map((response) => {
            return response.data;
        })
    );
};

export function getUserCustomerInfo(
    ctx: WidgetContext,
    service: CustomerService
): Observable<CustomerInfo> {
    return getUserCustomer(
        service,
        ctx
    ).pipe(
        switchMap((customer) => service.getCustomerInfo(
            customer.id.id
        ))
    );
};

export function getUserCustomerHierarchy(
    ctx: WidgetContext,
    service: CustomerService,
    groupService: EntityGroupService
): Observable<CompanyHierarchy | undefined> {
    // get user customer
    return getUserCustomer(
        service,
        ctx
    ).pipe(
        switchMap((customer) => getCustomerHierarchy(
            customer,
            groupService
        ))
    );
};
