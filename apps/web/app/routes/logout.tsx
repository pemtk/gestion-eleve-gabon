import { redirect } from 'react-router';
import { destroyUserSession } from '~/lib/session.server';
import type { Route } from './+types/logout';

export const loader = () => redirect('/');
export const action = ({ request }: Route.ActionArgs) => destroyUserSession(request);
