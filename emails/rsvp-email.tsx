import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/** All wording, already translated into the household's language. */
export type RsvpEmailText = {
  preview: string;
  eyebrow: string;
  dear: string;
  body: string;
  button: string;
  replyBy: string | null;
  fallback: string;
  love: string;
  personal: string;
};

export type RsvpEmailProps = {
  kind: "invitation" | "reminder";
  /** language code for <html lang> */
  lang: string;
  rtl: boolean;
  text: RsvpEmailText;
  couple: string;
  householdName: string;
  /** e.g. "Saturday 12 June 2027" */
  dateText: string | null;
  location: string | null;
  deadlineText: string | null;
  link: string;
  code: string;
  /** optional personal note from the couple */
  note: string;
  accent: "rose" | "sage";
  unsubscribeUrl?: string;
};

const ACCENTS = { rose: "#9b5a63", sage: "#4f6b58" };

/** Invitation / reminder email with the household's private RSVP link. */
export function RsvpEmail(p: RsvpEmailProps) {
  const color = ACCENTS[p.accent];
  const t = p.text;

  return (
    <Html lang={p.lang} dir={p.rtl ? "rtl" : "ltr"}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f7f3ec",
          fontFamily: "Georgia, 'Times New Roman', serif",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#fffdf9",
            maxWidth: 520,
            margin: "0 auto",
            padding: "40px 32px",
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              color,
              letterSpacing: 3,
              fontSize: 12,
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            {t.eyebrow}
          </Text>
          <Heading
            style={{
              textAlign: "center",
              fontWeight: "normal",
              fontSize: 36,
              color: "#3a2e2a",
              margin: "12px 0",
            }}
          >
            {p.couple}
          </Heading>
          {(p.dateText || p.location) && (
            <Text style={{ textAlign: "center", color: "#6b5d57", fontSize: 16, margin: 0 }}>
              {[p.dateText, p.location].filter(Boolean).join(" · ")}
            </Text>
          )}

          <Hr style={{ borderColor: "#eadfd3", margin: "28px 0" }} />

          <Text style={bodyText}>{t.dear}</Text>
          <Text style={bodyText}>{t.body}</Text>
          {p.note && (
            <Text style={{ ...bodyText, fontStyle: "italic", whiteSpace: "pre-line" }}>
              {p.note}
            </Text>
          )}

          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button
              href={p.link}
              style={{
                backgroundColor: color,
                color: "#ffffff",
                padding: "14px 28px",
                borderRadius: 8,
                fontFamily: "Arial, sans-serif",
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              {t.button}
            </Button>
          </Section>

          {t.replyBy && <Text style={{ ...bodyText, textAlign: "center" }}>{t.replyBy}</Text>}
          <Text style={{ ...smallText, textAlign: "center" }}>{t.fallback}</Text>

          <Text style={{ ...bodyText, marginTop: 28 }}>
            {t.love}
            <br />
            {p.couple}
          </Text>
        </Container>
        <Text style={{ ...smallText, textAlign: "center" }}>{t.personal}</Text>
        {p.unsubscribeUrl && (
          <Text style={{ ...smallText, textAlign: "center", marginTop: 4 }}>
            <Link href={p.unsubscribeUrl} style={{ color: "#8a7b74" }}>
              Unsubscribe from future emails
            </Link>
          </Text>
        )}
      </Body>
    </Html>
  );
}

const bodyText = {
  color: "#3a2e2a",
  fontSize: 16,
  lineHeight: "26px",
  fontFamily: "Arial, sans-serif",
};
const smallText = {
  color: "#8a7b74",
  fontSize: 13,
  lineHeight: "20px",
  fontFamily: "Arial, sans-serif",
};

// Sample data for the "react-email" preview tool.
RsvpEmail.PreviewProps = {
  kind: "invitation",
  lang: "en",
  rtl: false,
  text: {
    preview: "You’re invited to Ian & Maria’s wedding",
    eyebrow: "You’re invited",
    dear: "Dear The Smith Family,",
    body: "We would be so happy to celebrate with you. Please let us know who can make it using your personal RSVP link.",
    button: "RSVP now",
    replyBy: "Please reply by 1 May 2027.",
    fallback: "Button not working? Open https://example.com/r/K7P2QX or enter the code K7P2QX.",
    love: "With love,",
    personal: "This link is personal to your household. Please don’t share it.",
  },
  couple: "Ian & Maria",
  householdName: "The Smith Family",
  dateText: "Saturday 12 June 2027",
  location: "Sintra, Portugal",
  deadlineText: "1 May 2027",
  link: "https://example.com/r/K7P2QX",
  code: "K7P2QX",
  note: "",
  accent: "rose",
} satisfies RsvpEmailProps;

export default RsvpEmail;
