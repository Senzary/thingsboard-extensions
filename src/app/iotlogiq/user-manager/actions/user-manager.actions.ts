import { createAction, props } from "@ngrx/store";
import { UserManagerState } from "../reducers/user-manager.reducer";

export const setUser = createAction(
    '[Navbar] Set user',
    props<UserManagerState>()
);