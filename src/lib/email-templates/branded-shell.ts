import { T, CSS, esc, APP_URL } from './tokens'
import { ctaButton, footer } from './helpers'

export function brandedTemplate(opts: {
  title:        string
  preview?:     string
  body:         string
  ctaLabel?:    string
  ctaUrl?:      string
  accentBadge?: string
}): string {
  return /* html */`
<!doctype html>
<html lang="en"
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
  <title>${esc(opts.title)}</title>
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

  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${esc(opts.preview ?? opts.title)}&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
         style="background-color:${T.bgPage};">
    <tr>
      <td align="center" style="padding:36px 0 48px;">

        <table role="presentation" class="email-wrap" cellspacing="0" cellpadding="0" border="0"
               style="width:95%;max-width:640px;border-radius:14px;
                      box-shadow:0 8px 40px rgba(15,23,43,0.13);">

          <!-- HEADER -->
          <tr>
            <td style="border-radius:14px 14px 0 0;background:${T.headerBg};overflow:hidden;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="height:3px;background:${T.accentBar};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td class="hdr-pad" style="padding:28px 36px 12px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td class="logo-cell" style="vertical-align:middle;">
                          <a href="${APP_URL}" style="display:inline-block;text-decoration:none;line-height:0;">
                            <img src="https://app.meradarzi.pk/logo.png"
                                 width="144" height="auto" alt="MeraDarzi"
                                 style="display:block;width:144px;max-width:144px;height:auto;">
                          </a>
                        </td>
                        ${opts.accentBadge ? /* html */`
                        <td class="badge-cell" align="right" style="vertical-align:middle;">
                          <span style="display:inline-block;
                                       background:rgba(59,130,246,0.15);
                                       color:#93c5fd;
                                       font-family:${T.fontSans};font-size:10px;font-weight:700;
                                       padding:5px 14px;border-radius:20px;
                                       letter-spacing:0.1em;text-transform:uppercase;
                                       border:1px solid rgba(96,165,250,0.30);">
                            ${esc(opts.accentBadge)}
                          </span>
                        </td>` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 36px;">
                    <div style="height:1px;background:rgba(255,255,255,0.07);
                                font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td class="hdr-title" style="padding:20px 36px 32px;">
                    <h1 class="email-title"
                        style="margin:0 0 10px;color:#f1f5f9;
                               font-family:${T.fontSans};font-size:24px;font-weight:700;
                               line-height:1.3;letter-spacing:-0.4px;">
                      ${esc(opts.title)}
                    </h1>
                    ${opts.preview ? /* html */`
                    <p style="margin:0;color:rgba(241,245,249,0.58);
                               font-family:${T.fontSans};font-size:14px;
                               font-weight:400;line-height:1.75;">
                      ${esc(opts.preview)}
                    </p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td class="body-pad" style="padding:36px;background:${T.bgCard};">
              ${opts.body}
              ${opts.ctaUrl && opts.ctaLabel ? ctaButton(opts.ctaLabel, opts.ctaUrl) : ''}
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
