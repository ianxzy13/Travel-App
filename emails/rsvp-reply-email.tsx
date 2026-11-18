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

/** All wording, already translated into the couple member's app language. */
export type RsvpReplyEmailText = {
  preview: string;
  eyebrow: string;
  summary: string;
  attending: string;
  declined: string;
  noAnswer: string;
  dietary: string;
  song: string;
  message: string;
  button: string;
  why: string;
};

export type RsvpReplyGuest = {
  name: string;
  dietary: string | null;
  /** one line per event the guest is invited to */
  events: { name: string; status: "attending" | "declined" | null; meal: string | null }[];
};

export type RsvpReplyEmailProps = {
  lang: string;
  rtl: boolean;
  text: RsvpReplyEmailText;
  householdName: string;
  guests: RsvpReplyGuest[];
  /** hide the event name when the wedding has only one event */
  showEventNames: boolean;
  songRequest: string | null;
  message: string | null;
  link: string;
  accent: "rose" | "sage";
};

const ACCENTS = { rose: "#9b5a63", sage: "#4f6b58" };
const INK = "#3a2e2a";
const MUTED = "#6b5d57";
const SOFT = "#8a7b74";
const LINE = "#eadfd3";

/** Sent to the couple (owners and editors) when a household answers the RSVP. */
export function RsvpReplyEmail(p: RsvpReplyEmailProps) {
  const color = ACCENTS[p.accent];
  const t = p.text;
  const align = p.rtl ? "right" : "left";

  const statusText = (s: "attending" | "declined" | null) =>
    s === "attending" ? t.attending : s === "declined" ? t.declined : t.noAnswer;
  const statusColor = (s: "attending" | "declined" | null) => (s === "attending" ? color : SOFT);

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
            borderRadius: 8,
            border: `1px solid ${LINE}`,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              color,
              letterSpacing: 3,
              fontSize: 12,
              textTransform: "uppercase",
              fontFamily: "Arial, sans-serif",
              margin: 0,
            }}
          >
            {t.eyebrow}
          </Text>
          <Heading
            style={{
              textAlign: "center",
              fontWeight: "normal",
              fontSize: 32,
              lineHeight: "40px",
              color: INK,
              margin: "8px 0",
            }}
          >
            {p.householdName}
          </Heading>
          <Text style={{ ...sans, textAlign: "center", color: MUTED, fontSize: 16, margin: 0 }}>
            {t.summary}
          </Text>

          <Hr style={{ borderColor: LINE, margin: "32px 0 16px" }} />

          {p.guests.map((g, i) => (
            <Section
              key={i}
              style={{
                padding: "16px 0",
                borderBottom: i < p.guests.length - 1 ? `1px solid ${LINE}` : undefined,
              }}
            >
              <Text
                style={{
                  ...sans,
                  color: INK,
                  fontSize: 16,
                  fontWeight: 500,
                  margin: 0,
                  textAlign: align,
                }}
              >
                {g.name}
              </Text>
              {g.events.map((e, j) => (
                <Text
                  key={j}
                  style={{
                    ...sans,
                    fontSize: 14,
                    lineHeight: "22px",
                    margin: "4px 0 0",
                    textAlign: align,
                  }}
                >
                  {p.showEventNames && <span style={{ color: MUTED }}>{e.name}: </span>}
                  <span style={{ color: statusColor(e.status), fontWeight: 500 }}>
                    {statusText(e.status)}
                  </span>
                  {e.status === "attending" && e.meal && (
                    <span style={{ color: MUTED }}> · {e.meal}</span>
                  )}
                </Text>
              ))}
              {g.dietary && (
                <Text
                  style={{
                    ...sans,
                    color: MUTED,
                    fontSize: 14,
                    lineHeight: "22px",
                    margin: "4px 0 0",
                    textAlign: align,
                  }}
                >
                  {t.dietary}: {g.dietary}
                </Text>
              )}
            </Section>
          ))}

          {(p.message || p.songRequest) && <Hr style={{ borderColor: LINE, margin: "16px 0" }} />}
          {p.message && (
            <>
              <Text style={{ ...label, textAlign: align }}>{t.message}</Text>
              <Text
                style={{
                  color: INK,
                  fontSize: 16,
                  lineHeight: "26px",
                  fontStyle: "italic",
                  whiteSpace: "pre-line",
                  margin: "4px 0 16px",
                  textAlign: align,
                }}
              >
                {p.message}
              </Text>
            </>
          )}
          {p.songRequest && (
            <>
              <Text style={{ ...label, textAlign: align }}>{t.song}</Text>
              <Text
                style={{
                  ...sans,
                  color: INK,
                  fontSize: 16,
                  margin: "4px 0 16px",
                  textAlign: align,
                }}
              >
                {p.songRequest}
              </Text>
            </>
          )}

          <Section style={{ textAlign: "center", marginTop: 24 }}>
            <Button
              href={p.link}
              style={{
                backgroundColor: color,
                color: "#ffffff",
                padding: "14px 28px",
                borderRadius: 6,
                fontFamily: "Arial, sans-serif",
                fontSize: 13,
                letterSpacing: 1,
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              {t.button}
            </Button>
          </Section>
        </Container>
        <Text
          style={{
            ...sans,
            color: SOFT,
            fontSize: 12,
            lineHeight: "20px",
            textAlign: "center",
            maxWidth: 456,
            margin: "16px auto 0",
          }}
        >
          {t.why}
        </Text>
      </Body>
    </Html>
  );
}

const sans = { fontFamily: "Arial, sans-serif" };
const label = {
  ...sans,
  color: SOFT,
  fontSize: 12,
  letterSpacing: 2,
  textTransform: "uppercase" as const,
  margin: 0,
};

// Sample data for the "react-email" preview tool.
RsvpReplyEmail.PreviewProps = {
  lang: "en",
  rtl: false,
  text: {
    preview: "The Mitchell Family replied: 2 attending, 1 not attending",
    eyebrow: "New RSVP",
    summary: "2 attending, 1 not attending",
    attending: "Attending",
    declined: "Not attending",
    noAnswer: "No answer yet",
    dietary: "Dietary needs",
    song: "Song request",
    message: "Their message",
    button: "See all replies",
    why: "You get this email because “Email me when someone replies” is on in your RSVP settings.",
  },
  householdName: "The Mitchell Family",
  guests: [
    {
      name: "Sarah Mitchell",
      dietary: "Vegetarian",
      events: [
        { name: "Ceremony", status: "attending", meal: null },
        { name: "Dinner", status: "attending", meal: "Risotto" },
      ],
    },
    {
      name: "Tom Mitchell",
      dietary: null,
      events: [
        { name: "Ceremony", status: "attending", meal: null },
        { name: "Dinner", status: "attending", meal: "Sea bass" },
      ],
    },
    {
      name: "Emma Mitchell",
      dietary: null,
      events: [
        { name: "Ceremony", status: "declined", meal: null },
        { name: "Dinner", status: "declined", meal: null },
      ],
    },
  ],
  showEventNames: true,
  songRequest: "September by Earth, Wind & Fire",
  message: "We can’t wait to celebrate with you both!",
  link: "https://www.vowanywhere.com/app/rsvp",
  accent: "rose",
} satisfies RsvpReplyEmailProps;

export default RsvpReplyEmail;
