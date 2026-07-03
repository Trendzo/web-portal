// Global typings for the MSG91 sendOTP web widget (loaded from verify.msg91.com).
// With `exposeMethods: true`, initSendOTP attaches sendOtp/verifyOtp/retryOtp to `window`.
export {};

type Msg91Success = (data: unknown) => void;
type Msg91Failure = (error: unknown) => void;

declare global {
  interface Window {
    /** Initialise the widget. Call once after the provider script loads. */
    initSendOTP?: (config: {
      widgetId: string;
      tokenAuth: string;
      identifier?: string;
      /** When true, no popup renders and the methods below are exposed on window. */
      exposeMethods?: boolean;
      captchaRenderId?: string;
      success?: Msg91Success;
      failure?: Msg91Failure;
    }) => void;
    /** Send an OTP. identifier = country code (no '+') + number, e.g. "919876543210". */
    sendOtp?: (identifier: string, success?: Msg91Success, failure?: Msg91Failure) => void;
    /** Verify the entered OTP. On success, the data carries the server-verification token. */
    verifyOtp?: (
      otp: string | number,
      success?: Msg91Success,
      failure?: Msg91Failure,
      reqId?: string,
    ) => void;
    /** Resend the OTP. channel = null for the widget's default channel. */
    retryOtp?: (
      channel: string | null,
      success?: Msg91Success,
      failure?: Msg91Failure,
      reqId?: string,
    ) => void;
    getWidgetData?: () => unknown;
    isCaptchaVerified?: () => boolean;
  }
}
