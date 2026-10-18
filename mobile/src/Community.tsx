import { NativeHomes } from "./Homes";
import { theme } from "./theme";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  Modal,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { request, type Row } from "./api";
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n / 100);
const key = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const B = ({ title, onPress }: { title: string; onPress: () => void }) => (
  <Pressable accessibilityRole="button" style={s.button} onPress={onPress}>
    <Text style={s.buttonText}>{title}</Text>
  </Pressable>
);
const Field = ({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (x: string) => void;
}) => (
  <View style={s.field}>
    <Text style={s.small}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      style={s.input}
      value={value}
      onChangeText={set}
      multiline
    />
  </View>
);
export function NativeCommunity(props: { data: Row; view: string }) {
  const [section, setSection] = useState("items");
  if (props.view !== "exchange") return <NativeCommunityContent {...props} />;
  return (
    <View style={{ gap: 20 }}>
      <Text
        style={{
          fontSize: 30,
          fontWeight: "500",
          color: theme.text,
          letterSpacing: -1,
        }}
      >
        Marketplace<Text style={{ color: theme.orange }}>.</Text>
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["items", "homes"].map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityState={{ selected: section === v }}
            onPress={() => setSection(v)}
            style={{
              flex: 1,
              padding: 14,
              backgroundColor: section === v ? theme.selected : theme.surface,
              borderRadius: 9,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text
              style={{ color: theme.text, textAlign: "center", fontSize: 13 }}
            >
              {v === "items" ? "Items" : "Homes"}
            </Text>
          </Pressable>
        ))}
      </View>
      {section === "homes" ? (
        <NativeHomes />
      ) : (
        <NativeCommunityContent {...props} />
      )}
    </View>
  );
}
function NativeCommunityContent({ data, view }: { data: Row; view: string }) {
  const [members, setMembers] = useState<Row[]>([]),
    [pid, setPid] = useState(""),
    [w, setW] = useState<Row | null>(null),
    [listings, setListings] = useState<Row[]>([]),
    [next, setNext] = useState<number | null>(null),
    [selected, setSelected] = useState<Row | null>(null),
    [sellerProfile, setSellerProfile] = useState<Row | null>(null),
    [inbox, setInbox] = useState<Row[]>([]),
    [conversation, setConversation] = useState<Row | null>(null),
    [messages, setMessages] = useState<Row[]>([]),
    [message, setMessage] = useState(""),
    [draft, setDraft] = useState<Row | null>(null),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [question, setQuestion] = useState<Row | null>(null),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [payment, setPayment] = useState<Row | null>(null),
    [amount, setAmount] = useState(""),
    [reference, setReference] = useState(""),
    [account, setAccount] = useState<Row | null>(null);
  const month = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .slice(0, 7);
  async function load() {
    if (pid) {
      setW(await request(`my-project/${pid}`));
      try {
        setAccount(await request(`my-project/${pid}/accounts?month=${month}`));
      } catch {
        setAccount(null);
      }
    }
    const r = await request(`exchange?search=${encodeURIComponent(search)}`);
    setListings(r.listings);
    setNext(r.nextOffset);
    setInbox(await request("exchange/conversations"));
  }
  useEffect(() => {
    request("my-project")
      .then((r) => {
        setMembers(r.projects);
        setPid(r.projects[0]?.project_id || "");
      })
      .catch((e) => setError(e.message));
  }, [data.user.id]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [pid, view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!conversation) return;
    let live = true;
    const refresh = () =>
      request(`exchange/conversations/${conversation.id}`)
        .then((r) => {
          if (live) setMessages(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    refresh();
    const t = setInterval(refresh, 6000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [conversation]);
  async function act(fn: () => Promise<unknown>, refresh = true) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      if (refresh) await load();
    } catch (e) {
      setError((e as Error).message);
      Alert.alert("Please check", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const post = (path: string, b: Row) => request(path, "POST", b);
  const panel = (title: string, children: React.ReactNode) => (
    <View style={s.panel}>
      <Text style={s.h2}>{title}</Text>
      {children}
    </View>
  );
  const modal = (
    title: string,
    close: () => void,
    children: React.ReactNode,
  ) => (
    <Modal animationType="slide" onRequestClose={close}>
      <ScrollView contentContainerStyle={s.modal}>
        <B title="Close" onPress={close} />
        <Text style={s.heading}>{title}</Text>
        {children}
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
      </ScrollView>
    </Modal>
  );
  return (
    <View style={s.page}>
      <Text style={s.eyebrow}>
        {view === "exchange"
          ? "LESS WASTE. MORE NEIGHBOURHOOD."
          : "YOUR BUILDING. YOUR COMMUNITY."}
      </Text>
      <Text style={s.heading}>
        {view === "exchange"
          ? "Good things.\nNew homes."
          : w?.project.name || "My Project"}
      </Text>
      {!!error && <Text style={s.error}>{error}</Text>}
      {busy && <Text style={s.small}>Saving…</Text>}
      {view === "exchange" ? (
        <>
          <Text style={s.muted}>
            A private exchange for verified neighbours. Agree on payment and
            collection directly.
          </Text>
          <B
            title="＋ List an item"
            onPress={() =>
              setDraft({
                key: key(),
                projectId: pid,
                title: "",
                description: "",
                category: "Furniture",
                condition: "Good",
                type: "sale",
                price: 0,
                audience: "project",
                status: "draft",
                photos: [],
                exchangePreference: "",
              })
            }
          />
          <Field label="Search Exchange" value={search} set={setSearch} />
          <B title="Search / refresh" onPress={() => act(load)} />
          {listings.map((l) => (
            <Pressable
              key={l.id}
              style={s.panel}
              onPress={() => setSelected(l)}
            >
              {l.photos[0] ? (
                <Image source={{ uri: l.photos[0] }} style={s.photo} />
              ) : (
                <View style={s.art}>
                  <Text style={s.artText}>
                    {l.category === "Books" ? "BOOKS" : "A NEIGHBOUR’S FIND"}
                  </Text>
                </View>
              )}
              <Text style={s.small}>
                {l.category} · {l.condition} · {l.status}
              </Text>
              <Text style={s.h2}>{l.title}</Text>
              <Text style={s.price}>
                {l.type === "free" ? "Free to a good home" : money(l.price)}
              </Text>
              <Text style={s.small}>
                {l.audience === "network" ? "Across MDP" : "Project only"}
              </Text>
              <B
                title={l.saved ? "Unsave" : "Save item"}
                onPress={() =>
                  act(() =>
                    post(`exchange/${l.id}/action`, {
                      action: l.saved ? "unsave" : "save",
                    }),
                  )
                }
              />
            </Pressable>
          ))}
          {next !== null && (
            <B
              title="More finds"
              onPress={() =>
                act(async () => {
                  const r = await request(
                    `exchange?offset=${next}&search=${encodeURIComponent(search)}`,
                  );
                  setListings([...listings, ...r.listings]);
                  setNext(r.nextOffset);
                }, false)
              }
            />
          )}
          <Text style={s.h2}>Private enquiries</Text>
          {inbox.map((c) => (
            <B key={c.id} title={c.title} onPress={() => setConversation(c)} />
          ))}
        </>
      ) : (
        <>
          <Text style={s.muted}>
            Your project committee manages its own funds. MDP provides the
            software.
          </Text>
          <View style={s.chips}>
            {members.map((m) => (
              <B
                key={m.id}
                title={`${m.project} · ${m.label}`}
                onPress={() => setPid(m.project_id)}
              />
            ))}
          </View>
          {w && (
            <>
              <Text style={s.eyebrow}>
                {w.committeeMode
                  ? "COMMITTEE MEMBER · RESIDENT VIEW"
                  : "RESIDENT WORKSPACE"}
              </Text>
              {panel(
                "My maintenance dues",
                <>
                  <Text style={s.price}>
                    {money(
                      w.invoices
                        .filter(
                          (i: Row) =>
                            i.payer_id === data.user.id &&
                            ["published", "closed"].includes(i.state),
                        )
                        .reduce((a: number, i: Row) => a + i.balance, 0),
                    )}
                  </Text>
                  <Text style={s.small}>
                    Outstanding on published bills assigned to you
                  </Text>
                  {w.invoices
                    .filter(
                      (i: Row) =>
                        i.payer_id === data.user.id &&
                        ["published", "closed"].includes(i.state),
                    )
                    .map((i: Row) => (
                      <View style={s.divider} key={i.id}>
                        <Text style={s.h2}>
                          {i.month} · {i.label}
                        </Text>
                        {i.lines.map((l: Row, n: number) => (
                          <Text style={s.muted} key={n}>
                            {l.label} · {money(l.amount)}
                          </Text>
                        ))}
                        <Text style={s.muted}>
                          {i.status} · Due {i.due_date} · {money(i.balance)}
                        </Text>
                        <B
                          title="I paid my project"
                          onPress={() => {
                            setPayment(i);
                            setAmount(String(i.balance / 100));
                            setReference("");
                          }}
                        />
                      </View>
                    ))}
                </>,
              )}
              {panel(
                "Payment history",
                <>
                  {w.submissions
                    .filter((p: Row) => p.user_id === data.user.id)
                    .map((p: Row) => (
                      <Text key={p.id} style={s.muted}>
                        {money(p.amount)} · {p.reference} ·{" "}
                        {p.status === "submitted"
                          ? "Awaiting verification"
                          : "Committee verified"}
                      </Text>
                    ))}
                  {!w.submissions.length && (
                    <Text style={s.muted}>No payments submitted.</Text>
                  )}
                </>,
              )}
              {panel(
                "Monthly accounts",
                account ? (
                  <>
                    {[
                      "opening",
                      "receipts",
                      "payments",
                      "closing",
                      "receivables",
                      "payables",
                      "reserve",
                    ].map((k) => (
                      <View style={s.row} key={k}>
                        <Text style={s.muted}>{k}</Text>
                        <Text style={s.priceSmall}>{money(account[k])}</Text>
                      </View>
                    ))}
                    <Text style={s.small}>
                      Cash balance is separate from accrued expenses and
                      reserves. {month}
                    </Text>
                  </>
                ) : (
                  <Text style={s.muted}>
                    Accounts have not been published for this month.
                  </Text>
                ),
              )}
              {panel(
                "Noticeboard",
                <>
                  {w.operations
                    .filter((o: Row) =>
                      ["notice", "meeting", "asset", "faq"].includes(o.kind),
                    )
                    .map((o: Row) => (
                      <View key={o.id} style={s.divider}>
                        <Text style={s.small}>{o.kind}</Text>
                        <Text style={s.h2}>{o.title}</Text>
                        <Text style={s.muted}>{o.payload.body}</Text>
                        {o.payload.renewal && (
                          <Text style={s.small}>
                            Renewal {o.payload.renewal}
                          </Text>
                        )}
                      </View>
                    ))}
                </>,
              )}
              {panel(
                "Ask my project committee",
                <>
                  <Field label="Subject" value={subject} set={setSubject} />
                  <Field
                    label="Your private question"
                    value={body}
                    set={setBody}
                  />
                  <B
                    title="Send privately to committee"
                    onPress={() =>
                      act(async () => {
                        await post(`my-project/${pid}/questions`, {
                          subject,
                          body,
                          category: "General",
                          visibility: "private",
                        });
                        setSubject("");
                        setBody("");
                      })
                    }
                  />
                  {w.questions.map((q: Row) => (
                    <B
                      key={q.id}
                      title={`${q.subject} · ${q.status}`}
                      onPress={() => setQuestion(q)}
                    />
                  ))}
                </>,
              )}
              {panel(
                "Your committee",
                <>
                  {w.committee.map((a: Row) => (
                    <View key={a.id} style={s.divider}>
                      <Text style={s.h2}>{a.name}</Text>
                      <Text style={s.small}>
                        {a.position.replace("_", " ")} · {a.ends}
                      </Text>
                    </View>
                  ))}
                  <Text style={s.muted}>
                    Use the private project helpdesk for official contact.
                  </Text>
                </>,
              )}
            </>
          )}
        </>
      )}
      {selected &&
        modal(
          selected.title,
          () => setSelected(null),
          <>
            <View style={s.chips}>
              {selected.photos.map((p: string, i: number) => (
                <Image key={i} source={{ uri: p }} style={s.photo} />
              ))}
            </View>
            <Text style={s.price}>{money(selected.price)}</Text>
            <Text style={s.muted}>{selected.description}</Text>
            <Text style={s.small}>
              By {selected.seller.name}. Listing enquiries do not unlock
              profiles or reveal flat / contact details.
            </Text>
            <B
              title="View permitted seller profile"
              onPress={() =>
                act(async () => {
                  const p = await request(`profiles/${selected.user_id}`);
                  setSellerProfile(p);
                  setSelected(null);
                })
              }
            />
            {selected.user_id === data.user.id ? (
              <B
                title="Manage listing"
                onPress={() => {
                  setDraft({
                    ...selected,
                    projectId: selected.project_id,
                    key: selected.request_key,
                    exchangePreference: selected.exchange_preference,
                  });
                  setSelected(null);
                }}
              />
            ) : (
              <B
                title="Ask about this item"
                onPress={() =>
                  act(async () => {
                    const c = await post(`exchange/${selected.id}/action`, {
                      action: "enquire",
                    });
                    setConversation({
                      ...c,
                      title: selected.title,
                      seller_id: selected.user_id,
                    });
                    setSelected(null);
                  })
                }
              />
            )}
            <B
              title="Report listing"
              onPress={() =>
                act(() =>
                  post("exchange/reports", {
                    kind: "listing",
                    targetId: selected.id,
                    reason: "Resident requested review of this listing",
                  }),
                )
              }
            />
          </>,
        )}
      {sellerProfile &&
        modal(
          sellerProfile.name,
          () => setSellerProfile(null),
          <>
            <Text style={s.small}>
              {sellerProfile.project} ·{" "}
              {sellerProfile.locked ? "Locked profile" : "Resident profile"}
            </Text>
            {sellerProfile.avatar && (
              <Image source={{ uri: sellerProfile.avatar }} style={s.photo} />
            )}
            <Text style={s.muted}>
              {sellerProfile.canSeeDetails
                ? sellerProfile.bio
                : "This neighbour keeps profile details private. An enquiry does not change those permissions."}
            </Text>
            {!!sellerProfile.occupation && (
              <Text style={s.muted}>{sellerProfile.occupation}</Text>
            )}
            {!!sellerProfile.contact && (
              <Text style={s.muted}>{sellerProfile.contact}</Text>
            )}
          </>,
        )}
      {draft &&
        modal(
          draft.id ? "Manage listing" : "Your listing preview & editor",
          () => setDraft(null),
          <>
            {!draft.id && (
              <View style={s.chips}>
                {members.map((m) => (
                  <B
                    key={m.id}
                    title={`${draft.projectId === m.project_id ? "✓ " : ""}${m.project} · ${m.label}`}
                    onPress={() =>
                      setDraft({ ...draft, projectId: m.project_id })
                    }
                  />
                ))}
              </View>
            )}
            <Field
              label="Title"
              value={draft.title}
              set={(v) => setDraft({ ...draft, title: v })}
            />
            <Field
              label="Description"
              value={draft.description}
              set={(v) => setDraft({ ...draft, description: v })}
            />
            <Field
              label="Price ₹"
              value={String(draft.price / 100)}
              set={(v) =>
                setDraft({ ...draft, price: Math.round(Number(v) * 100) })
              }
            />
            <Text style={s.small}>Type</Text>
            <View style={s.chips}>
              {["sale", "free", "wanted", "exchange"].map((type) => (
                <B
                  key={type}
                  title={(draft.type === type ? "✓ " : "") + type}
                  onPress={() => setDraft({ ...draft, type })}
                />
              ))}
            </View>
            <Text style={s.small}>Category</Text>
            <View style={s.chips}>
              {[
                "Furniture",
                "Appliances",
                "Electronics",
                "Books",
                "Children’s items",
                "Cycles",
                "Fitness",
                "Home and garden",
                "Other",
              ].map((category) => (
                <B
                  key={category}
                  title={(draft.category === category ? "✓ " : "") + category}
                  onPress={() => setDraft({ ...draft, category })}
                />
              ))}
            </View>
            <View style={s.chips}>
              {["New", "Like new", "Good", "Fair"].map((condition) => (
                <B
                  key={condition}
                  title={
                    (draft.condition === condition ? "✓ " : "") + condition
                  }
                  onPress={() => setDraft({ ...draft, condition })}
                />
              ))}
            </View>
            <Field
              label="Swap preference (optional)"
              value={draft.exchangePreference}
              set={(v) => setDraft({ ...draft, exchangePreference: v })}
            />
            <Text style={s.small}>Explicitly share across MDP</Text>
            <Switch
              value={draft.audience === "network"}
              onValueChange={(v) =>
                setDraft({ ...draft, audience: v ? "network" : "project" })
              }
            />
            <B
              title="Add item photo (up to 5)"
              onPress={() =>
                act(async () => {
                  if (draft.photos.length >= 5)
                    throw new Error("Maximum five photos");
                  const r = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    allowsEditing: true,
                    quality: 0.5,
                    base64: true,
                  });
                  if (!r.canceled && r.assets[0].base64)
                    setDraft({
                      ...draft,
                      photos: [
                        ...draft.photos,
                        `data:image/jpeg;base64,${r.assets[0].base64}`,
                      ],
                    });
                })
              }
            />
            {draft.photos.map((p: string, i: number) => (
              <Pressable
                key={i}
                onPress={() =>
                  setDraft({
                    ...draft,
                    photos: draft.photos.filter(
                      (_: string, n: number) => i !== n,
                    ),
                  })
                }
              >
                <Image style={s.photo} source={{ uri: p }} />
                <Text style={s.small}>Tap to remove photo</Text>
              </Pressable>
            ))}
            <Text style={s.h2}>
              , Preview: {draft.title || "Your next neighbour’s find"}
            </Text>
            <Text style={s.muted}>{draft.description}</Text>
            {draft.id ? (
              <View style={s.chips}>
                {["active", "reserved", "sold", "withdrawn"].map((status) => (
                  <B
                    key={status}
                    title={status}
                    onPress={() =>
                      act(async () => {
                        await post(`exchange/${draft.id}`, {
                          ...draft,
                          status,
                        });
                        setDraft(null);
                      })
                    }
                  />
                ))}
              </View>
            ) : (
              <>
                <B
                  title="Save draft"
                  onPress={() =>
                    act(async () => {
                      await post("exchange", { ...draft, status: "draft" });
                      setDraft(null);
                    })
                  }
                />
                <B
                  title="Publish listing"
                  onPress={() =>
                    act(async () => {
                      await post("exchange", { ...draft, status: "active" });
                      setDraft(null);
                    })
                  }
                />
              </>
            )}
          </>,
        )}
      {conversation &&
        modal(
          conversation.title || "Private enquiry",
          () => setConversation(null),
          <>
            <Text style={s.small}>
              Profile permissions remain unchanged. Updates every 6 seconds.
            </Text>
            {messages.map((m) => (
              <View key={m.id} style={s.panel}>
                <Text style={s.small}>
                  {m.user_id === data.user.id ? "You" : "Neighbour"}
                </Text>
                <Text style={s.muted}>{m.body}</Text>
              </View>
            ))}
            <Field label="Your message" value={message} set={setMessage} />
            <B
              title="Send"
              onPress={() =>
                act(async () => {
                  await post(`exchange/conversations/${conversation.id}`, {
                    body: message,
                    key: key(),
                  });
                  setMessage("");
                  setMessages(
                    await request(`exchange/conversations/${conversation.id}`),
                  );
                })
              }
            />
            <B
              title="Report conversation"
              onPress={() =>
                act(() =>
                  post("exchange/reports", {
                    kind: "conversation",
                    targetId: conversation.id,
                    reason: "Resident requested conversation review",
                  }),
                )
              }
            />
            <B
              title="Block neighbour"
              onPress={() =>
                act(async () => {
                  await post(
                    `blocks/${conversation.buyer_id === data.user.id ? conversation.seller_id : conversation.buyer_id}`,
                    {},
                  );
                  setConversation(null);
                })
              }
            />
          </>,
        )}
      {payment &&
        modal(
          "Submit payment record",
          () => setPayment(null),
          <>
            <Text style={s.muted}>
              Pay your project directly. This submission stays pending until
              another committee member checks the project’s records.
            </Text>
            <Field label="Amount ₹" value={amount} set={setAmount} />
            <Field
              label="Bank / cash reference"
              value={reference}
              set={setReference}
            />
            <B
              title="Submit for verification"
              onPress={() =>
                act(async () => {
                  await post(`my-project/${pid}/payments`, {
                    invoiceId: payment.id,
                    amount: Math.round(Number(amount) * 100),
                    reference,
                    key: key(),
                  });
                  setPayment(null);
                })
              }
            />
          </>,
        )}
      {question &&
        modal(
          question.subject,
          () => setQuestion(null),
          <>
            <Text style={s.small}>
              {question.visibility} · {question.status}
            </Text>
            <Text style={s.muted}>{question.body}</Text>
            {question.replies.map((r: Row) => (
              <View key={r.id} style={s.panel}>
                <Text style={s.small}>{r.name}</Text>
                <Text style={s.muted}>{r.body}</Text>
              </View>
            ))}
            <Field label="Reply" value={message} set={setMessage} />
            <B
              title="Send reply"
              onPress={() =>
                act(async () => {
                  await post(`my-project/${pid}/questions/${question.id}`, {
                    body: message,
                  });
                  setMessage("");
                  const nw = await request(`my-project/${pid}`);
                  setQuestion(
                    nw.questions.find((q: Row) => q.id === question.id),
                  );
                })
              }
            />
            {["open", "escalated"].map((status) => (
              <B
                key={status}
                title={status === "open" ? "Reopen" : "Escalate"}
                onPress={() =>
                  act(async () => {
                    await post(`my-project/${pid}/questions/${question.id}`, {
                      status,
                    });
                    setQuestion({ ...question, status });
                  })
                }
              />
            ))}
          </>,
        )}
    </View>
  );
}
const s = StyleSheet.create({
  page: { gap: 18 },
  eyebrow: { color: "#f3f3f1", fontSize: 9, letterSpacing: 2, lineHeight: 18 },
  heading: {
    marginVertical: 12,

    fontFamily: undefined,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
    color: theme.text,
  },
  h2: {
    marginVertical: 12,

    fontFamily: undefined,
    fontSize: 22,
    color: theme.text,
  },
  muted: { color: "#b3b3b3", fontSize: 13, lineHeight: 23 },
  small: { lineHeight: 18, color: theme.secondary, fontSize: 11 },
  price: { color: "#f3f3f1", fontSize: 31, marginVertical: 12 },
  priceSmall: { color: "#f3f3f1", fontSize: 17 },
  button: {
    borderWidth: 1,

    padding: 13,
    marginVertical: 6,

    backgroundColor: theme.selected,
    borderColor: theme.border,
    borderRadius: theme.controlRadius,
    minHeight: theme.touchTarget,
  },
  buttonText: { color: "#f3f3f1", fontSize: 12, textAlign: "center" },
  panel: {
    borderWidth: 1,

    padding: 20,

    gap: 9,

    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: theme.radius,
  },
  field: { gap: 8, marginVertical: 9 },
  input: {
    color: "#f3f3f1",

    borderWidth: 1,

    padding: 13,

    minHeight: 44,

    backgroundColor: theme.background,
    borderColor: theme.border,
    borderRadius: theme.controlRadius,
  },
  photo: { height: 200, width: "100%", borderRadius: 10, marginVertical: 12 },
  art: {
    height: 150,
    backgroundColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  artText: { color: "#f3f3f1", letterSpacing: 2, fontSize: 11 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  modal: {
    padding: 25,
    paddingTop: 65,
    paddingBottom: 70,
    backgroundColor: "#121212",
    minHeight: "100%",
    gap: 13,
  },
  error: {
    backgroundColor: "#3a3a3a20",
    padding: 15,
    color: "#f3f3f1",
    fontSize: 12,
  },
  divider: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: "#f3f3f110",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
});
