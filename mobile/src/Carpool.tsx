import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Linking } from "react-native";
import { request, type Row } from "./api";
export function NativeCarpool({ data, act, busy, styles: s }: any) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [view, setView] = useState("discover"),
    [phone, setPhone] = useState<Record<string, string>>({}),
    [consent, setConsent] = useState<Record<string, boolean>>({}),
    [offer, setOffer] = useState(false),
    [pickup, setPickup] = useState(""),
    [destination, setDestination] = useState(""),
    [day, setDay] = useState(""),
    [time, setTime] = useState(""),
    [seats, setSeats] = useState("2"),
    [report, setReport] = useState(""),
    [reason, setReason] = useState("");
  const button = (label: string, fn: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={fn}
      style={[s.panel, { padding: 12, opacity: busy || disabled ? 0.5 : 1 }]}
    >
      <Text style={s.bold}>{label}</Text>
    </Pressable>
  );
  const input = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    phone = false,
  ) => (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor="#7a7a7a"
      value={value}
      onChangeText={onChange}
      keyboardType={phone ? "phone-pad" : "default"}
      style={s.input}
    />
  );
  const action = (r: Row, body: Row, message: string) =>
    act(() => request(`rides/${r.id}`, "PATCH", body), message);
  const share = (r: Row) => (
    <View>
      {input(
        "Phone to share on this journey",
        phone[r.id] || "",
        (v) => setPhone({ ...phone, [r.id]: v }),
        true,
      )}
      {button(
        `${consent[r.id] ? "✓ " : ""}I consent to sharing with accepted connections`,
        () => setConsent({ ...consent, [r.id]: !consent[r.id] }),
      )}
      {button(
        "Share my phone",
        () =>
          action(
            r,
            { action: "share_contact", contact: phone[r.id] },
            "Phone sharing updated",
          ),
        !consent[r.id] || !phone[r.id],
      )}
      {r.ownContact &&
        button("Stop sharing my phone", () =>
          action(
            r,
            { action: "share_contact", contact: "" },
            "Phone sharing stopped",
          ),
        )}
      <Text style={s.note}>
        Only accepted participants can see your number. Removing it cannot erase
        saved copies.
      </Text>
    </View>
  );
  const call = (number: string | null) =>
    number ? (
      button(`Call ${number}`, () => {
        void Linking.openURL(`tel:${number}`);
      })
    ) : (
      <Text style={s.note}>
        Your neighbour has not shared a phone number yet.
      </Text>
    );
  const rides = data.rides.filter(
    (r: Row) =>
      r.pickup.toLowerCase().includes(from.toLowerCase().trim()) &&
      r.destination.toLowerCase().includes(to.toLowerCase().trim()) &&
      (view === "offers"
        ? r.user_id === data.user.id
        : view === "connections"
          ? r.requests.some((q: Row) =>
              ["pending", "accepted"].includes(q.status),
            )
          : r.user_id !== data.user.id),
  );
  return (
    <>
      <Text style={s.eyebrow}>MD One CONNECT</Text>
      <Text style={s.heading}>A shared direction.</Text>
      <Text style={s.body}>
        Discover neighbours going your way. Connect when you both say yes.
      </Text>
      {button(
        offer ? "Close offer" : "Offer a journey",
        () => setOffer(!offer),
        !data.services?.carpool,
      )}
      {offer && (
        <View style={s.panel}>
          {input("Public pickup area", pickup, setPickup)}
          {input("Destination area", destination, setDestination)}
          {input("Departure date YYYY-MM-DD · IST", day, setDay)}
          {input("Departure time HH:MM · 24-hour IST", time, setTime)}
          {input("Available seats 1–6", seats, setSeats)}
          {button("Publish journey", () => {
            void act(() => {
              const d = new Date(`${day}T${time}:00+05:30`);
              if (
                !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
                !/^\d{2}:\d{2}$/.test(time) ||
                !Number.isFinite(d.getTime())
              )
                throw new Error("Enter a valid date and 24-hour time.");
              return request("rides", "POST", {
                pickup,
                destination,
                departure: d.toISOString(),
                seats: Number(seats),
                recurrence: "once",
              });
            }, "Journey published").then((ok: any) => {
              if (ok) {
                setOffer(false);
                setView("offers");
              }
            });
          })}
        </View>
      )}
      {input("Search pickup area", from, setFrom)}
      {input("Search destination", to, setTo)}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {["discover", "connections", "offers"].map((v) => (
          <View key={v}>
            {button(`${view === v ? "✓ " : ""}${v}`, () => setView(v))}
          </View>
        ))}
      </View>
      {!data.services?.carpool ? (
        <Text style={s.note}>
          Connections are not enabled for your project.
        </Text>
      ) : !rides.length ? (
        <Text style={s.note}>
          No journeys here yet. Try another area or offer a journey.
        </Text>
      ) : (
        rides.map((r: Row) => (
          <View key={r.id} style={s.panel}>
            <Text style={s.bold}>{r.driver} · demo resident</Text>
            <Text style={s.note}>{r.project}</Text>
            <Text style={s.sectionTitle}>
              {r.pickup} → {r.destination}
            </Text>
            <Text style={s.body}>
              {new Date(r.departure).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST · {r.seats} seats
            </Text>
            {r.user_id === data.user.id ? (
              <>
                {share(r)}
                {button("Cancel journey", () =>
                  action(r, { action: "cancel" }, "Journey cancelled"),
                )}
                {r.requests.map((q: Row) => (
                  <View key={q.id}>
                    <Text style={s.bold}>
                      {q.name} · {q.status}
                    </Text>
                    {q.status === "pending" && (
                      <>
                        {button("Accept connection", () =>
                          action(
                            r,
                            { action: "accept", requestId: q.id },
                            "Connection accepted",
                          ),
                        )}
                        {button("Decline", () =>
                          action(
                            r,
                            { action: "reject", requestId: q.id },
                            "Request declined",
                          ),
                        )}
                      </>
                    )}
                    {q.status === "accepted" && (
                      <>
                        {call(q.contact)}
                        {button("Block resident", () =>
                          action(
                            r,
                            { action: "block", targetId: q.user_id },
                            "Resident blocked",
                          ),
                        )}
                      </>
                    )}
                  </View>
                ))}
              </>
            ) : (
              <>
                {!r.requests.length
                  ? button(
                      "Send connection request",
                      () =>
                        action(
                          r,
                          { action: "request" },
                          "Connection request sent",
                        ),
                      !r.seats,
                    )
                  : r.requests.map((q: Row) => (
                      <View key={q.id}>
                        <Text style={s.bold}>
                          {q.status === "accepted"
                            ? "You're connected"
                            : `Request ${q.status}`}
                        </Text>
                        {q.status === "accepted" && (
                          <>
                            {call(r.contact)}
                            {share(r)}
                          </>
                        )}
                        {["pending", "accepted"].includes(q.status) &&
                          button("Withdraw connection", () =>
                            action(
                              r,
                              { action: "withdraw" },
                              "Connection withdrawn",
                            ),
                          )}
                      </View>
                    ))}
                {button("Report journey", () => {
                  setReport(r.id);
                  setReason("");
                })}
                {button("Block resident", () =>
                  action(
                    r,
                    { action: "block", targetId: r.user_id },
                    "Resident blocked",
                  ),
                )}
                {report === r.id && (
                  <>
                    {input("Reason for report", reason, setReason)}
                    {button("Submit report", () => {
                      void action(
                        r,
                        { action: "report", reason },
                        "Report submitted",
                      ).then((ok: any) => {
                        if (ok) setReport("");
                      });
                    })}
                    {button("Close report", () => setReport(""))}
                  </>
                )}
              </>
            )}
          </View>
        ))
      )}
      <Text style={s.note}>
        MDP helps residents connect. Ride arrangements and payments are agreed
        directly between participants. No MDP ride payments or live tracking.
        Search matches area names; road-route matching is not connected.
      </Text>
    </>
  );
}
