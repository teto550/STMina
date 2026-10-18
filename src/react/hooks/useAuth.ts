// Everything about signing in, as React Query hooks. The functions that do the work are plain ones in src/api/ (no React in them);
// each hook adds what a screen needs: `isPending` (show a loader), `error` (show a message), and `data`.
//
//   const login = useLogin();
//   login.mutate({ email, password });            login.isPending / login.error / login.reset()
import {useEffect, useState} from 'react';
import {useIsMutating, useMutation, useQuery} from '@tanstack/react-query';
import type {User} from 'firebase/auth';
import {loadAccountDecision} from '@/api/account';
import {registerServant, signIn, signOutUser, subscribeAuth, type RegisterInput} from '@/api/auth';
import type {Section} from '@/types/access';
import type {LoginValues} from '@/schemas/auth';

export const authKeys = {
    account: (uid: string) => ['auth', 'account', uid] as const,
    register: ['auth', 'register'] as const,
};

export type AuthUserState =
    | { status: 'loading'; user: null }
    | { status: 'signed-out'; user: null }
    | { status: 'signed-in'; user: User };

/** Who is signed in right now. `loading` until Firebase has said (a returning visitor is restored from the device). */
export function useAuthUser(): AuthUserState {
    const [state, setState] = useState<AuthUserState>({status: 'loading', user: null});
    useEffect(() => subscribeAuth((user) => setState(user ? {status: 'signed-in', user} : {
        status: 'signed-out',
        user: null
    })), []);
    return state;
}

/**
 * May the signed-in person use the app? `data` is the decision (see AccountDecision), `isLoading` while it is being worked out,
 * `isError` when the account could not be read at all (offline with nothing cached is NOT an error: it is the "unregistered" decision).
 * It is worked out once per sign-in and never refreshed by itself, so it costs one read.
 */
export function useAccount(user: User | null, enabled = true) {
    return useQuery({
        queryKey: authKeys.account(user?.uid ?? 'none'),
        queryFn: () => loadAccountDecision(user as User),
        enabled: !!user && enabled,
        staleTime: Infinity,
        gcTime: 0,
        retry: false,
    });
}

export function useLogin() {
    return useMutation({mutationFn: ({email, password}: LoginValues) => signIn(email, password)});
}

export function useLogout() {
    return useMutation({mutationFn: signOutUser});
}

/** "New servant". `section` is the section this device is set to (it decides gender and the list of classes). */
export function useRegister(section: Section) {
    return useMutation({
        mutationKey: authKeys.register,
        mutationFn: (input: RegisterInput) => registerServant(input, section)
    });
}

/**
 * Is a registration being sent right now, from anywhere? (Creating the account signs the new person in for a moment; the sign-in screen
 * must not treat that as a login.)
 */
export function useIsRegistering(): boolean {
    return useIsMutating({mutationKey: authKeys.register}) > 0;
}
