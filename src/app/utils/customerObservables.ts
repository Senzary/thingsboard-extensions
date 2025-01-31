import { CustomerService, EntityGroupService } from "@app/core/public-api";
import { WidgetContext } from "@app/modules/home/models/widget-component.models";
import { Customer, CustomerInfo, EntityType } from "@shared/public-api";
import { map, Observable, switchMap } from "rxjs";
import { CompanyHierarchy, COMPANY_HIERARCHIES, SZPageLink, SENZARY_CUSTOMER_NAME } from "./public-api";



/**
 * returns observable with customer that belongs to 
 * & represents the tenant.
 * @param {CustomerService} service - http customer service 
 * @returns 
 */
export function getSenzaryCustomer(
    service: CustomerService
): Observable<Customer> {
    const pageLink = new SZPageLink(10, 0, SENZARY_CUSTOMER_NAME);
    return service.getCustomers(pageLink).pipe(
        map((response) => response.data[0])
    );
};

export function getCustomerHierarchy(
    customer: Customer, 
    service: EntityGroupService
): Observable<CompanyHierarchy> {
    // get groups it belongs to?
    return service.getEntityGroupIdsForEntityId(
        EntityType.CUSTOMER,
        customer.id.id
    ).pipe(
        switchMap((groupIds) => {
            return service.getEntityGroupEntityInfosByIds(
                groupIds.map(g => g.id)
            );
        }),
        // get hierarchy group and return hierarchy
        map((groupInfos) => {
            for (const [key, value] of Object.entries(COMPANY_HIERARCHIES)) {
                for (const group of groupInfos) {
                    if (group.name === value.groupName) {
                        // this is hierarchy for this customer
                        console.log('>>> 💚 hierarchy found:', key, value, group);
                        return CompanyHierarchy[key.toUpperCase()];
                    }
                }
            }
            return undefined;
        })
    );
};

export function getCustomerCustomers(
    customerObservable: Observable<Customer | CustomerInfo>,
    ctx: WidgetContext,
    service: CustomerService 
): Observable<CustomerInfo[]> {
    return customerObservable.pipe(
        switchMap((customerInfo) => {
            const pageLink = ctx.pageLink(100,0);
            return service.getCustomerCustomerInfos(
                true,
                customerInfo.id.id,
                pageLink
            );
        }),
        map((response) => response.data)
    );
};
