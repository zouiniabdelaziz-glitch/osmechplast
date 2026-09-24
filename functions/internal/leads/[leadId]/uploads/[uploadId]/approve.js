import { onRequestPost as handler } from '../../../../../upload/employee-route.mjs';
export const onRequestPost = (context) => handler({ ...context, action: 'approve' });
