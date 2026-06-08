import { T, esc, APP_URL, SUPPORT_EMAIL, WA_DISPLAY, WA_LINK } from './tokens'

export function detailTable(rows: [string, unknown][]): string {
  return /* html */`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
         style="border-collapse:collapse;border-radius:10px;overflow:hidden;
                border:1px solid ${T.border};margin:0 0 4px;">
    ${rows.map(([label, val], i) => {
      const last = i === rows.length - 1
      const borderBottom = last ? 'none' : `1px solid ${T.border}`
      return /* html */`
      <tr>
        <td class="dl-label" width="32%"
            style="padding:11px 14px;background:${T.bgSection};color:${T.textMuted};
                   font-family:${T.fontSans};font-size:11px;font-weight:600;
                   text-transform:uppercase;letter-spacing:0.07em;vertical-align:top;
                   border-bottom:${borderBottom};">
          ${esc(label)}
        </td>
        <td class="dl-value"
            style="padding:11px 14px;background:${T.white};color:${T.textHeading};
                   font-family:${T.fontSans};font-size:13px;font-weight:500;
                   border-left:1px solid ${T.border};border-bottom:${borderBottom};
                   vertical-align:top;word-break:break-word;">
          ${esc(val)}
        </td>
      </tr>`
    }).join('')}
  </table>`
}

export function ctaButton(label: string, url: string): string {
  return /* html */`
  <table role="presentation" cellspacing="0" cellpadding="0" border="0"
         style="margin-top:28px;">
    <tr>
      <td class="cta-td" align="left">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                     xmlns:w="urn:schemas-microsoft-com:office:word"
                     href="${url}"
                     style="height:48px;v-text-anchor:middle;width:240px;"
                     arcsize="20%" stroke="f" fillcolor="${T.blue}">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">
            ${esc(label)} &#8594;
          </center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${url}" class="cta-btn"
           style="display:inline-block;padding:14px 34px;
                  background-color:${T.blue};color:${T.white};
                  font-family:${T.fontSans};font-size:14px;font-weight:700;
                  text-decoration:none;border-radius:10px;letter-spacing:0.02em;
                  box-shadow:0 4px 16px rgba(59,130,246,0.32);mso-hide:all;">
          ${esc(label)} &#8594;
        </a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`
}

export function footer(): string {
  return /* html */`
  <tr>
    <td class="footer-pad"
        style="padding:26px 36px 32px;background:${T.bgSection};
               border-radius:0 0 14px 14px;border-top:1px solid ${T.border};">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td align="center" style="padding-bottom:14px;">
            <a href="${APP_URL}" style="display:inline-block;text-decoration:none;line-height:0;">
              <img src="https://app.meradarzi.pk/logo.png" width="108" height="auto" alt="MeraDarzi"
                   style="width:108px;max-width:108px;height:auto;opacity:0.75;">
            </a>
            <p style="margin:8px 0 0;color:${T.textFaint};font-family:${T.fontSans};
                      font-size:10px;font-weight:600;letter-spacing:0.09em;
                      text-transform:uppercase;">
              Pakistan&rsquo;s #1 Tailor Management App
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:16px;">
            <div style="height:1px;background:${T.border};font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                   style="margin:0 auto;">
              <tr>
                <td class="f-link-cell"
                    style="padding:0 14px;border-right:1px solid ${T.border};">
                  <a href="mailto:${SUPPORT_EMAIL}"
                     style="color:${T.blue};font-family:${T.fontSans};font-size:12px;
                            font-weight:500;text-decoration:none;">${SUPPORT_EMAIL}</a>
                </td>
                <td class="f-link-cell"
                    style="padding:0 14px;border-right:1px solid ${T.border};">
                  <a href="https://wa.me/${WA_LINK}"
                     style="color:${T.textBody};font-family:${T.fontSans};font-size:12px;
                            font-weight:500;text-decoration:none;">${WA_DISPLAY}</a>
                </td>
                <td class="f-link-cell" style="padding:0 14px;">
                  <a href="${APP_URL}"
                     style="color:${T.blue};font-family:${T.fontSans};font-size:12px;
                            font-weight:500;text-decoration:none;">meradarzi.pk</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 0 13px;">
            <div style="height:1px;background:${T.border};font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td align="center">
            <p style="margin:0;color:${T.textFaint};font-family:${T.fontSans};
                      font-size:11px;line-height:1.85;">
              &copy; ${new Date().getFullYear()} MeraDarzi. All rights reserved.<br>
              This email was sent because you have an account with MeraDarzi.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}
