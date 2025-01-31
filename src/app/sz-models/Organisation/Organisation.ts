import { Authority, AuthUser, Customer, CustomerInfo, EntityId, PageLink } from "@shared/public-api";
import { IOrganisation } from "./Organisation.types";
import { CustomerService } from "thingsboard/src/app/core/public-api";
import { map, Observable, of, switchMap } from "rxjs";
import { FormField, SENZARY_CUSTOMER_NAME, FieldsetType } from "../../utils/public-api";

const organisationFields: Record<FieldsetType, FormField[]> = {
    basic: [],
    contact: [],
    downlink: [],
    image: [],
    kpi: [],
    map: [],
    provisioning: [],
    telemetry: [], 
    threshold: []
};

export class Organisation implements IOrganisation {
    entityId?: EntityId;
    entityLabel?: string;
    entityName?: string;
    customerService: CustomerService;
    self?: CustomerInfo;
    fields = organisationFields;
    constructor(
        customerService: CustomerService
    ) {
        this.customerService = customerService;
    };
    /**
     * returns an observable with this user's customer; if user
     * is not customer_user then it loads senzary parent customer.
     * @param {AuthUser} user - user that belongs to a customer
     * @returns {Observable<CustomerInfo>} observable - an observable with this user customer's info.
     */
    loadFromAuthUser(user: AuthUser): Observable<CustomerInfo> {
        let customerIdObservable = of(user.customerId); 
        if (user.authority !== Authority.CUSTOMER_USER) {
            customerIdObservable = this.loadSenzaryCustomer().pipe(
                map((customer) => customer.id.id)
            );
        }
        return customerIdObservable.pipe(
            switchMap((customerId) => this.customerService
                .getCustomerInfo(customerId))
        );
    };
    loadSenzaryCustomer(): Observable<Customer> {
        const pageLink = new PageLink(10, 0, SENZARY_CUSTOMER_NAME);
        return this.customerService.getCustomers(pageLink).pipe(
            map((response) => response.data[0])
        );
    };
};
