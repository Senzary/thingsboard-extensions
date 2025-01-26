import { EntityGroupService } from "@app/core/public-api";
import { EntityType } from "@shared/public-api";
import { map, Observable, switchMap } from "rxjs";

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