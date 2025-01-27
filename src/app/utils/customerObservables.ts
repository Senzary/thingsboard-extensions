import { CustomerService, EntityGroupService } from "@app/core/public-api";
import { WidgetContext } from "@app/modules/home/models/widget-component.models";
import { Customer, EntityType } from "@shared/public-api";
import { map, Observable, switchMap } from "rxjs";
import { CompanyHierarchy } from "./public-api";

const SENZARY_CUSTOMER_NAME = 'Senzary Tenant Customer';

export function getSenzaryCustomer(
    service: CustomerService, 
    ctx: WidgetContext
): Observable<Customer> {
    const pageLink = ctx.pageLink(10, 0, SENZARY_CUSTOMER_NAME);
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
            for (const group of groupInfos) {
                const name = group.name.toUpperCase().slice(-1);
                if (name in CompanyHierarchy) {
                    return CompanyHierarchy[name];
                }
            }
            return undefined;
        })
    );
};
