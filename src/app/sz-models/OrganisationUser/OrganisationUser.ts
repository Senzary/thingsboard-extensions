import { AuthUser, EntityId, EntityInfoData, UserInfo } from "@shared/public-api";
import { UserService } from "@core/public-api";
import { IOrganisationUser, OrganisationUserRole } from "./OrganisationUser.types";
import { Observable, tap } from "rxjs";


export class OrganisationUser implements IOrganisationUser {
    entityId?: EntityId;
    entityName?: string;
    entityLabel?: string;
    userService: UserService;
    self?: UserInfo;
    scope?: OrganisationUserRole;
    constructor(
        userService: UserService
    ) {
        this.userService = userService;
        this.scope = OrganisationUserRole.VIEWER;
    };
    /**
     * returns observable that provisions entity props, self & scope when
     * subscribed to.
     * @param {AuthUser} authUser - widget context current user `ctx.currentUser` 
     */
    loadFromAuthUser(authUser: AuthUser): Observable<UserInfo> {
        return this.userService.getUserInfo(authUser.userId)
            .pipe(
                tap((userInfo) => this.self = userInfo),
                tap((userInfo) => {
                    this.scope = this.getScopeFrom(userInfo.groups);
                }),
                tap((userInfo) => {
                    this.entityId = userInfo.id;
                    this.entityName = userInfo.name;
                    this.entityLabel = userInfo.label;
                })
            );
    };
    /** 
     * takes in a list of user groups and returns scope based
     * on OrganisationUserRoles enum values present on group name.
     * @param {EntityInfoData[]} groups - user groups the user belongs to
     */
    getScopeFrom(groups: EntityInfoData[]) {
        for (const group of groups) {
            for (const key in OrganisationUserRole) {
                if (group.name
                    .toLowerCase()
                    .includes(OrganisationUserRole[key])
                ) {
                    return OrganisationUserRole[key];
                }
            }
        }
        return OrganisationUserRole.VIEWER;
    };
}