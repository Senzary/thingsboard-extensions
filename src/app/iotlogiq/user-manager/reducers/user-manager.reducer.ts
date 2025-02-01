import { createReducer, on } from "@ngrx/store";
import { setUser } from "../actions/user-manager.actions";
import { UserInfo } from "@shared/public-api";
import {UserManagerActions} from "../actions/public-api";

export interface UserManagerState {
    user?: UserInfo;
};

export const INITIAL_USER_STATE: UserManagerState = {
    user: undefined
};

export const userManagerReducer = createReducer(
    INITIAL_USER_STATE,
    on(UserManagerActions.setUser, (state, {user}) => {
        console.log('>>> 🍊 going through reduce', state, user);
        return {...state, user}
    })
);
