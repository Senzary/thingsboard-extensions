import { UserService } from "@core/public-api";
import { UserInfo } from "@shared/public-api";
import { BaseManager } from "src/app/utils/types";

export enum UserScope {
    ADMIN = "admin",
    OPERATOR = "operator",
    VIEWER = "viewer"
}

export interface IUserManager extends BaseManager<UserInfo> {
    userService: UserService;
    scope?: UserScope
};



