import { CustomerService } from "@app/core/public-api";
import { WidgetContext } from "@app/modules/home/models/widget-component.models";
import { Authority, AuthUser, Customer } from "@shared/public-api";
import { map, Observable, of, switchMap } from "rxjs";

const SENZARY_CUSTOMER_NAME = 'Senzary Tenant Customer';

export function getUserCustomer(
    user: AuthUser, 
    customerService: CustomerService,
    ctx: WidgetContext
): Observable<Customer> {
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

export function getSenzaryCustomer(
    service: CustomerService, 
    ctx: WidgetContext
): Observable<Customer> {
    const pageLink = ctx.pageLink(10, 0, SENZARY_CUSTOMER_NAME);
    return service.getCustomers(pageLink).pipe(
        map((response) => response.data[0])
    );
};
