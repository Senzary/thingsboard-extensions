import { StateParams } from "@app/core/public-api";
import { Customer } from "@app/shared/public-api";

export interface AssetManagementDashboardStateParams extends StateParams {
    currentCustomer?: Customer;
};
