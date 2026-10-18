import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  Image,
  Switch,
  Linking,
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { request, type Row } from "./api";
import { theme as t } from "./theme";
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n / 100);
export function NativeHomes() {
  const [result, setResult] = useState<Row | null>(null),
    [purpose, setPurpose] = useState(""),
    [search, setSearch] = useState(""),
    [mine, setMine] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [draft, setDraft] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [phone, setPhone] = useState(""),
    [consent, setConsent] = useState(false);
  const sequence = useRef(0);
  async function load() {
    const n = ++sequence.current;
    try {
      const r = await request(
        "homes?" + new URLSearchParams({ purpose, search }),
      );
      if (sequence.current === n) setResult(r);
    } catch (e) {
      if (sequence.current === n) setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [purpose, search]);
  const button = (label: string, fn: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={fn}
      style={[s.button, { opacity: busy || disabled ? 0.5 : 1 }]}
    >
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
  async function act(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      await load();
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function detail(id: string) {
    const r = await act(() => request("homes/" + id));
    if (r) {
      setSelected(r);
      setPhone(r.ownContact || "");
      setConsent(false);
    }
  }
  async function action(b: Row) {
    if (!selected) return;
    if (await act(() => request(`homes/${selected.id}/action`, "POST", b)))
      await detail(selected.id);
  }
  const modal = (
    title: string,
    close: () => void,
    children: React.ReactNode,
  ) => (
    <Modal animationType="slide" onRequestClose={close}>
      <ScrollView
        contentContainerStyle={s.modal}
        keyboardShouldPersistTaps="handled"
      >
        {button("Close", close)}
        <Text style={s.heading}>{title}</Text>
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        {children}
      </ScrollView>
    </Modal>
  );
  const input = (
    label: string,
    value: string,
    change: (v: string) => void,
    numeric = false,
  ) => (
    <View style={s.field}>
      <Text style={s.meta}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={value}
        onChangeText={change}
        keyboardType={numeric ? "numeric" : "default"}
      />
    </View>
  );
  function start() {
    setError("");
    setDraft({
      key: `home-${Date.now()}-${Math.random()}`,
      flatId: result?.ownedFlats[0]?.id,
      purpose: "rent",
      title: "",
      description: "",
      bhk: "2",
      area: "",
      floor: "0",
      furnishing: "Unfurnished",
      parking: "1",
      available: "",
      price: "",
      deposit: "0",
      photos: [],
      consent: false,
    });
  }
  const cards = mine ? result?.mine || [] : result?.listings || [];
  return (
    <View style={{ gap: 18 }}>
      <Text style={s.meta}>Owner-listed. Community-connected.</Text>
      <Text style={s.heading}>A home, closer to your people.</Text>
      <Text style={s.body}>
        Homes for rent or sale across My Dream Projects.
      </Text>
      {!!result?.ownedFlats.length && button("List your home +", start)}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7 }}
      >
        {[
          ["", "All homes"],
          ["rent", "For rent"],
          ["sale", "For sale"],
        ].map(([id, label]) => (
          <View key={id}>
            {button(`${purpose === id && !mine ? "✓ " : ""}${label}`, () => {
              setPurpose(id);
              setMine(false);
            })}
          </View>
        ))}
        {button(mine ? "✓ My listings" : "My listings", () => setMine(!mine))}
      </ScrollView>
      {input("Search project or home", search, setSearch)}
      {!!error && !draft && !selected && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!result ? (
        <Text style={s.body}>Loading community homes…</Text>
      ) : !cards.length ? (
        <View style={s.panel}>
          <Text style={s.heading}>A place for your next place.</Text>
          <Text style={s.body}>
            No homes in this view yet. Only verified owners can publish a flat
            for rent or sale.
          </Text>
          {!!result.ownedFlats.length && button("List your home", start)}
        </View>
      ) : (
        cards.map((l: Row) => (
          <Pressable
            accessibilityRole="button"
            key={l.id}
            style={s.panel}
            onPress={() => void detail(l.id)}
          >
            {l.photos[0] ? (
              <Image source={{ uri: l.photos[0] }} style={s.photo} />
            ) : (
              <View style={s.placeholder}>
                <Text style={s.body}>Owner photos not added</Text>
              </View>
            )}
            <Text style={s.meta}>
              {l.project} · For {l.purpose === "rent" ? "rent" : "sale"} ·{" "}
              {l.status}
            </Text>
            <Text style={s.title}>{l.title}</Text>
            <Text style={s.body}>
              {l.bhk} BHK · {l.area} sq ft · {l.furnishing}
            </Text>
            <Text style={s.price}>
              {money(l.price)}
              {l.purpose === "rent" ? " / month" : ""} ↗
            </Text>
          </Pressable>
        ))
      )}
      {!mine &&
        result?.next != null &&
        button("Load more homes", () => {
          void (async () => {
            setBusy(true);
            setError("");
            const n = ++sequence.current;
            try {
              const r = await request(
                "homes?" +
                  new URLSearchParams({
                    purpose,
                    search,
                    offset: String(result.next),
                  }),
              );
              if (sequence.current === n)
                setResult({
                  ...r,
                  listings: [...result.listings, ...r.listings],
                });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          })();
        })}
      {button("Refresh homes", () => void load())}
      <Text style={s.meta}>
        Private to verified MDP members. Exact flat numbers stay private. Owners
        approve interest; phone sharing is optional. Visits, agreements and
        payments are arranged directly.
      </Text>
      {draft &&
        modal(
          "List your home",
          () => setDraft(null),
          <>
            {["rent", "sale"].map((v) => (
              <View key={v}>
                {button(
                  `${draft.purpose === v ? "✓ " : ""}For ${v === "rent" ? "rent" : "sale"}`,
                  () => setDraft({ ...draft, purpose: v }),
                )}
              </View>
            ))}
            <Text style={s.meta}>
              Choose your verified flat (number stays private)
            </Text>
            {result?.ownedFlats.map((f: Row) => (
              <View key={f.id}>
                {button(
                  `${draft.flatId === f.id ? "✓ " : ""}${f.project} · ${f.label}`,
                  () => setDraft({ ...draft, flatId: f.id }),
                )}
              </View>
            ))}
            {[
              ["title", "Listing title", false],
              ["bhk", "BHK", true],
              ["area", "Area · sq ft", true],
              ["floor", "Floor", true],
              ["parking", "Parking spaces", true],
              ["available", "Available from · YYYY-MM-DD", false],
              [
                "price",
                draft.purpose === "rent"
                  ? "Monthly rent · ₹"
                  : "Asking price · ₹",
                true,
              ],
              ...(draft.purpose === "rent"
                ? [["deposit", "Security deposit · ₹", true]]
                : []),
              [
                "description",
                "Description · omit phone numbers, flat number and documents",
                false,
              ],
            ].map(([key, label, num]) => (
              <View key={String(key)}>
                {input(
                  String(label),
                  String(draft[String(key)]),
                  (value) => setDraft({ ...draft, [String(key)]: value }),
                  !!num,
                )}
              </View>
            ))}
            <Text style={s.meta}>Furnishing</Text>
            {["Unfurnished", "Semi-furnished", "Furnished"].map((v) => (
              <View key={v}>
                {button(`${draft.furnishing === v ? "✓ " : ""}${v}`, () =>
                  setDraft({ ...draft, furnishing: v }),
                )}
              </View>
            ))}
            {button("Add home photo", () => {
              void act(async () => {
                if (draft.photos.length >= 8)
                  throw new Error("Use up to eight photos.");
                const r = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  allowsEditing: true,
                  quality: 0.5,
                  base64: true,
                });
                if (!r.canceled && r.assets[0].base64) {
                  const photo = `data:image/jpeg;base64,${r.assets[0].base64}`;
                  if (photo.length > 530000)
                    throw new Error("Choose a smaller photo.");
                  setDraft({ ...draft, photos: [...draft.photos, photo] });
                }
                return { ok: true };
              });
            })}
            <ScrollView horizontal>
              {draft.photos.map((p: string, i: number) => (
                <Pressable
                  key={i}
                  accessibilityLabel={`Remove photo ${i + 1}`}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      photos: draft.photos.filter(
                        (_: string, n: number) => n !== i,
                      ),
                    })
                  }
                >
                  <Image
                    source={{ uri: p }}
                    style={{
                      width: 100,
                      height: 80,
                      margin: 5,
                      borderRadius: 8,
                    }}
                  />
                </Pressable>
              ))}
            </ScrollView>
            <View style={s.consent}>
              <Switch
                value={draft.consent}
                onValueChange={(v) => setDraft({ ...draft, consent: v })}
              />
              <Text style={s.body}>
                I am authorised to list this flat and share these details with
                verified MDP members.
              </Text>
            </View>
            <Text style={s.meta}>
              Available for 30 days. Renew from My listings. Prices and home
              details are owner-provided.
            </Text>
            {button(
              "Publish home listing",
              () => {
                void act(() =>
                  request("homes", "POST", {
                    ...draft,
                    bhk: Number(draft.bhk),
                    area: Number(draft.area),
                    floor: Number(draft.floor),
                    parking: Number(draft.parking),
                    price: Math.round(Number(draft.price) * 100),
                    deposit: Math.round(Number(draft.deposit) * 100),
                  }),
                ).then((r) => {
                  if (r) {
                    setDraft(null);
                    setMine(true);
                  }
                });
              },
              !draft.consent,
            )}
          </>,
        )}
      {selected &&
        modal(
          selected.title,
          () => setSelected(null),
          <>
            {selected.photos.map((p: string, i: number) => (
              <Image key={i} source={{ uri: p }} style={s.photo} />
            ))}
            <Text style={s.meta}>
              {selected.project} · For{" "}
              {selected.purpose === "rent" ? "rent" : "sale"} ·{" "}
              {selected.status}
            </Text>
            <Text style={s.price}>
              {money(selected.price)}
              {selected.purpose === "rent" ? " / month" : ""}
            </Text>
            <Text style={s.body}>
              {selected.bhk} BHK · {selected.area} sq ft · Floor{" "}
              {selected.floor} · {selected.furnishing} · {selected.parking}{" "}
              parking
            </Text>
            <Text style={s.body}>
              Available {selected.available}
              {selected.purpose === "rent"
                ? ` · Deposit ${money(selected.deposit)}`
                : ""}
            </Text>
            <Text style={s.body}>{selected.description}</Text>
            <Text style={s.meta}>
              Listed by {selected.owner}. Exact flat number stays private.
            </Text>
            {selected.own ? (
              <>
                {["available", "expired"].includes(selected.status) && (
                  <>
                    {button(
                      "Renew for 30 days",
                      () => void action({ action: "renew" }),
                    )}
                    {button(
                      selected.purpose === "rent" ? "Mark rented" : "Mark sold",
                      () =>
                        void action({
                          action: "status",
                          status:
                            selected.purpose === "rent" ? "rented" : "sold",
                        }),
                    )}
                    {button(
                      "Withdraw listing",
                      () =>
                        void action({ action: "status", status: "withdrawn" }),
                    )}
                  </>
                )}
                <Text style={s.title}>Resident interest</Text>
                {!selected.interests.length && (
                  <Text style={s.body}>No requests yet. Refresh to check.</Text>
                )}
                {selected.interests.map((q: Row) => (
                  <View key={q.id} style={s.panel}>
                    <Text style={s.body}>
                      {q.name} · {q.status}
                    </Text>
                    {q.status === "pending" &&
                      selected.status === "available" && (
                        <>
                          {button(
                            "Accept interest",
                            () =>
                              void action({
                                action: "accept",
                                requestId: q.id,
                              }),
                          )}
                          {button(
                            "Decline",
                            () =>
                              void action({
                                action: "decline",
                                requestId: q.id,
                              }),
                          )}
                        </>
                      )}
                    {q.contact &&
                      button(
                        `Call ${q.contact}`,
                        () => void Linking.openURL("tel:" + q.contact),
                      )}
                  </View>
                ))}
              </>
            ) : selected.status === "available" ? (
              <>
                {!selected.interests.length
                  ? button(
                      "I'm interested ↗",
                      () => void action({ action: "interest" }),
                    )
                  : selected.interests.map((q: Row) => (
                      <View key={q.id} style={s.panel}>
                        <Text style={s.body}>Interest {q.status}</Text>
                        {q.status === "accepted" &&
                          (selected.contact ? (
                            button(
                              `Call owner · ${selected.contact}`,
                              () =>
                                void Linking.openURL("tel:" + selected.contact),
                            )
                          ) : (
                            <Text style={s.meta}>
                              The owner has not shared a phone number yet.
                            </Text>
                          ))}
                        {["pending", "accepted"].includes(q.status) &&
                          button(
                            "Withdraw interest",
                            () => void action({ action: "withdraw" }),
                          )}
                      </View>
                    ))}
              </>
            ) : (
              <Text style={s.body}>This home is no longer available.</Text>
            )}
            {selected.status === "available" &&
              (selected.own ||
                selected.interests.some(
                  (q: Row) => q.status === "accepted",
                )) && (
                <>
                  <Text style={s.title}>Share your phone, by choice</Text>
                  {input("Phone number", phone, setPhone)}
                  <View style={s.consent}>
                    <Switch value={consent} onValueChange={setConsent} />
                    <Text style={s.body}>
                      Share with{" "}
                      {selected.own
                        ? "accepted residents on this listing"
                        : "this owner"}
                      .
                    </Text>
                  </View>
                  {button(
                    "Share phone",
                    () =>
                      void action({
                        action: "contact",
                        contact: phone,
                        consent,
                      }),
                    !consent,
                  )}
                  {selected.ownContact &&
                    button(
                      "Stop sharing",
                      () => void action({ action: "contact", contact: "" }),
                    )}
                  <Text style={s.meta}>
                    Removing a number cannot erase copies someone already saved.
                  </Text>
                </>
              )}
            {button("Refresh details", () => void detail(selected.id))}
          </>,
        )}
    </View>
  );
}
const s = StyleSheet.create({
  heading: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "500",
    letterSpacing: -0.8,
    color: t.text,
  },
  title: { fontSize: 18, fontWeight: "500", color: t.text },
  body: { fontSize: 12, lineHeight: 21, color: t.secondary, flexShrink: 1 },
  meta: { fontSize: 10, lineHeight: 18, color: t.secondary },
  price: { fontSize: 23, color: t.text, fontWeight: "500" },
  button: {
    backgroundColor: t.selected,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 44,
    alignItems: "center",
    marginVertical: 4,
  },
  buttonText: { fontSize: 12, fontWeight: "500", color: t.text },
  panel: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 14,
    padding: 18,
    gap: 13,
  },
  photo: { width: "100%", height: 210, borderRadius: 12 },
  placeholder: {
    height: 150,
    backgroundColor: t.overlay,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 8,
    backgroundColor: t.background,
    color: t.text,
    minHeight: 44,
    padding: 12,
    fontSize: 13,
  },
  field: { gap: 7, marginVertical: 6 },
  modal: {
    padding: 22,
    paddingTop: 60,
    paddingBottom: 70,
    backgroundColor: t.background,
    minHeight: "100%",
    gap: 17,
  },
  consent: { flexDirection: "row", alignItems: "center", gap: 12 },
  error: {
    color: t.text,
    backgroundColor: t.overlay,
    padding: 14,
    fontSize: 12,
    lineHeight: 20,
  },
});
