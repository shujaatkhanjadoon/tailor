import { T, CSS, APP_URL } from './tokens'
import { footer } from './helpers'

export function buildOtpEmailHtml(otp: string, purpose: 'signup' | 'login'): string {
  const isSignup = purpose === 'signup'
  const subject  = isSignup
    ? 'MeraDarzi — Account Verify Karein'
    : 'MeraDarzi — Login OTP'

  return /* html */`
<!doctype html>
<html lang="ur"
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
  <title>${subject}</title>
  <!--[if mso]><noscript><xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml></noscript><![endif]-->
  <style>${T.fontImport}${CSS}</style>
</head>

<body class="email-shell"
      style="margin:0;padding:0;background-color:${T.bgPage};
             font-family:${T.fontSans};word-break:break-word;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${isSignup ? 'Aapka verification code aa gaya hai' : 'Aapka login code aa gaya hai'}
    — 10 minute mein expire hoga.&#847;&#847;&#847;&#847;&#847;
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
         style="background:${T.bgPage};">
    <tr>
      <td align="center" style="padding:36px 0 48px;">

        <table role="presentation" class="email-wrap" cellspacing="0" cellpadding="0" border="0"
               style="width:95%;max-width:600px;border-radius:14px;
                      box-shadow:0 8px 40px rgba(15,23,43,0.13);">

          <!-- HEADER -->
          <tr>
            <td style="border-radius:14px 14px 0 0;background:${T.headerBg};overflow:hidden;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="height:3px;background:${T.accentBar};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td class="hdr-pad" style="padding:26px 34px 14px;">
                    <a href="${APP_URL}" style="display:inline-block;text-decoration:none;line-height:0;">
                      <img src="https://app.meradarzi.pk/logo.png"
                           width="136" height="auto" alt="MeraDarzi"
                           style="display:block;width:136px;max-width:136px;height:auto;">
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 34px;">
                    <div style="height:1px;background:rgba(255,255,255,0.07);
                                font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td class="hdr-title" style="padding:18px 34px 30px;">
                    <h1 class="email-title"
                        style="margin:0 0 9px;color:#f1f5f9;
                               font-family:${T.fontSans};font-size:22px;font-weight:700;
                               line-height:1.3;letter-spacing:-0.3px;">
                      ${isSignup ? 'Aapka Account Verify Karein' : 'Login Verification Code'}
                    </h1>
                    <p style="margin:0;color:rgba(241,245,249,0.58);
                               font-family:${T.fontSans};font-size:13px;
                               font-weight:400;line-height:1.75;">
                      ${isSignup
                        ? 'MeraDarzi account activate karne ke liye yeh one-time code use karein.'
                        : 'Apne MeraDarzi account mein securely login karne ke liye yeh code use karein.'}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td class="body-pad" style="padding:34px;background:${T.bgCard};">

              <!-- OTP card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                     style="margin:0 0 22px;">
                <tr>
                  <td align="center"
                      style="background:${T.bluePale};border:1.5px solid ${T.blueBorder};
                             border-radius:12px;padding:30px 20px;">
                    <p style="margin:0 0 8px;color:${T.textMuted};
                               font-family:${T.fontSans};font-size:11px;font-weight:600;
                               text-transform:uppercase;letter-spacing:0.12em;">
                      Your One-Time Code
                    </p>
                    <div class="otp-code"
                         style="font-family:${T.fontMono};font-size:50px;font-weight:900;
                                letter-spacing:14px;color:${T.headerBg};line-height:1.1;
                                margin:4px 0 18px;padding-left:14px;">
                      ${otp}
                    </div>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                           style="margin:0 auto;">
                      <tr>
                        <td style="background:#dbeafe;border-radius:20px;padding:6px 16px;">
                          <p style="margin:0;color:${T.blueDeep};font-family:${T.fontSans};
                                    font-size:12px;font-weight:600;">
                            &#9201;&nbsp; Expires in 10 minutes
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- How to use -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                     style="margin:0 0 20px;">
                <tr>
                  <td style="background:${T.bgSection};border-radius:10px;padding:18px 20px;">
                    <p style="margin:0 0 13px;color:${T.textHeading};
                               font-family:${T.fontSans};font-size:13px;font-weight:600;">
                      How to use this code:
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      ${['Open the MeraDarzi app or website.',
                         'Enter the 6-digit code above when prompted.',
                         'Code is valid for one-time use only.'].map((step, i) => /* html */`
                      <tr>
                        <td width="30" style="vertical-align:top;padding:4px 12px 4px 0;">
                          <div style="background:${T.headerBg};color:#93c5fd;
                                      font-family:${T.fontSans};font-size:11px;font-weight:700;
                                      width:22px;height:22px;min-width:22px;
                                      border-radius:50%;text-align:center;line-height:22px;">
                            ${i + 1}
                          </div>
                        </td>
                        <td style="vertical-align:top;padding:4px 0;
                                   color:${T.textBody};font-family:${T.fontSans};
                                   font-size:13px;font-weight:400;line-height:1.65;">
                          ${step}
                        </td>
                      </tr>`).join('')}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security notice -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background:${T.amberBg};border:1px solid ${T.amberBorder};
                             border-left:4px solid ${T.amberLeft};
                             border-radius:0 10px 10px 0;padding:14px 16px;">
                    <p style="margin:0;color:${T.amberText};font-family:${T.fontSans};
                               font-size:12px;font-weight:500;line-height:1.7;">
                      <strong>&#9888; Security Notice:</strong> Yeh code sirf aapke liye hai.
                      Kisi ke saath share mat karein — MeraDarzi ka koi bhi staff member kabhi
                      yeh code nahi maangega. Agar aapne yeh request nahi ki, toh is email ko
                      ignore karein.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          ${footer()}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
