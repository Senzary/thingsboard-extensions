import { BaseModel, FieldsetType, FormField } from "../../utils/public-api";
import { CustomerService } from "@core/public-api";
import { CustomerInfo, EntityId } from "@shared/public-api";

export interface IOrganisation extends BaseModel<CustomerInfo> {
    customerService: CustomerService;
    fields?: Record<FieldsetType, FormField[]>;
};
