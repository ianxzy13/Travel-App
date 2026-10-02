import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type TravelReminderText = {
  preview: string;
  eyebrow: string;
  dear: string;
  body: string;
  button: string;
  fallback: string;
  love: string;
};

export type TravelReminderProps = {
  lang: string;
  rtl: boolean;
  text: TravelReminderText;
  couple: string;
  householdName: string;
  dateText: string | null;
  location: string | null;
  link: string;
  accent: "rose" | "sage";
};

const ACCENTS = { rose: "#9b5a63", sage: "#4f6b58" };

export function TravelReminderEmail(p: TravelReminderProps) {
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
          padding: "32px 0",
        }}
      >
        <Container style={{ maxWidth: "520px", margin: "0 auto" }}>
          <Section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "48px 40px",
              boxShadow: "0 1px 3px rgba(0,0,0,.08)",
            }}
          >
            <Text style={{ color, fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase" as const }}>
              {t.eyebrow}
            </Text>
            <Heading style={{ color: "#1a1a1a", fontSize: "24px", margin: "8px 0 4px" }}>
              {p.couple}
            </Heading>
            {p.dateText && (
              <Text style={{ color: "#555", fontSize: "14px", margin: "0 0 4px" }}>
                {p.dateText}
              </Text>
            )}
            {p.location && (
              <Text style={{ color: "#555", fontSize: "14px", margin: "0 0 24px" }}>
                {p.location}
              </Text>
            )}
            <Hr style={{ borderColor: "#e5e0d8", margin: "16px 0" }} />
            <Text style={{ color: "#333", fontSize: "16px", lineHeight: "1.6", margin: "0 0 8px" }}>
              {t.dear}
            </Text>
            <Text style={{ color: "#333", fontSize: "16px", lineHeight: "1.6" }}>
              {t.body}
            </Text>
            <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
              <Button
                href={p.link}
                style={{
                  backgroundColor: color,
                  color: "#fff",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "15px",
                  padding: "12px 32px",
                  textDecoration: "none",
                }}
              >
                {t.button}
              </Button>
            </Section>
            <Text style={{ color: "#888", fontSize: "12px", lineHeight: "1.5" }}>
              {t.fallback}
            </Text>
            <Hr style={{ borderColor: "#e5e0d8", margin: "24px 0 16px" }} />
            <Text style={{ color: "#333", fontSize: "16px" }}>{t.love}</Text>
            <Text style={{ color: "#333", fontSize: "16px", fontWeight: 600 }}>{p.couple}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
