import type { z } from 'zod'
import type { schemas } from './schemas'

export type CreateShopInput = z.infer<typeof schemas.createShop>
export type LoginInput = z.infer<typeof schemas.login>
export type VerifyOtpInput = z.infer<typeof schemas.verifyOtp>
export type SendOtpInput = z.infer<typeof schemas.sendOtp>
export type UpdatePinInput = z.infer<typeof schemas.updatePin>
export type DeletePhotoInput = z.infer<typeof schemas.deletePhoto>
export type DeleteShopInput = z.infer<typeof schemas.deleteShop>
export type EncryptPinInput = z.infer<typeof schemas.encryptPin>
export type AdminActionInput = z.infer<typeof schemas.adminAction>
export type AdminNotificationPostInput = z.infer<typeof schemas.adminNotificationPost>
export type AdminNotificationPatchInput = z.infer<typeof schemas.adminNotificationPatch>
