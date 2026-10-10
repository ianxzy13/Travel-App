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

export type StdEmailText = {
  preview: string;
  eyebrow: string;
  heading: string;
  body: string;
  button: string;
  fallback: string;
  love: string;
  personal: string;
};

export type StdEmailProps = {
  lang: string;
  rtl: boolean;
  text: StdEmailText;
  couple: string;
  dateText: string | null;
  location: string | null;
  message: string | null;
  link: string;
  accentColor: string;
  unsubscribeUrl?: string;
};

export function SaveTheDateEmail(p: StdEmailProps) {
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
              color: p.accentColor,
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

          <Text style={bodyText}>{t.body}</Text>
          {p.message && (
            <Text style={{ ...bodyText, fontStyle: "italic", whiteSpace: "pre-line" }}>
              {p.message}
            </Text>
          )}

          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button
              href={p.link}
              style={{
                backgroundColor: p.accentColor,
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
              Unsubscribe
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

SaveTheDateEmail.PreviewProps = {
  lang: "en",
  rtl: false,
  text: {
    preview: "Save the Date for Ian & Maria's wedding!",
    eyebrow: "Save the Date",
    heading: "Save the Date",
    body: "We're getting married and would love for you to be there! Mark your calendar and stay tuned for the official invitation.",
    button: "View details",
    fallback: "Button not working? Open https://example.com/s/abc123",
    love: "With love,",
    personal: "This link is personal to your household.",
  },
  couple: "Ian & Maria",
  dateText: "Saturday 12 June 2027",
  location: "Sintra, Portugal",
  message: "We can't wait to celebrate with you!",
  link: "https://example.com/s/abc123",
  accentColor: "#C4A265",
} satisfies StdEmailProps;

export default SaveTheDateEmail;
