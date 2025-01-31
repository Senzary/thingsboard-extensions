import { UserService } from "@core/public-api";
import { EntityId, UserInfo } from "@shared/public-api";
import { BaseModel } from "src/app/utils/types";

export enum OrganisationUserRole {
    ADMIN = "admin",
    OPERATOR = "operator",
    VIEWER = "viewer"
}

export interface IOrganisationUser extends BaseModel<UserInfo> {
    userService: UserService;
    scope?: OrganisationUserRole
};



