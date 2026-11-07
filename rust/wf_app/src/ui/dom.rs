//! Web page elements driven from Rust. The menus are described each frame as a tree of [`Node`]s
//! (tag, attributes, children, click action); [`Dom::render`] diffs the tree against the one on
//! the page and sends only the changes through the loader's generic element bridge
//! (`wf_dom_*` in `web/index.html`: create, attribute, text, insert, remove, listen). The bridge
//! knows nothing about the game; structure, styling and every decision live here in Rust.
//! Clicks come back as `wf_dom_event(handle, time)` and are queued for the frame loop.
//! Natively (tests) the bridge is a no-op and the tree is inspected directly.
use std::cell::RefCell;
use std::collections::HashMap;

/// One element (or a text node when `tag` is empty).
#[derive(Clone, Debug, PartialEq)]
pub struct Node<A> {
    pub tag: &'static str,
    /// Nodes with different keys are never morphed into each other (fresh element, fresh scroll).
    pub key: &'static str,
    pub attrs: Vec<(&'static str, String)>,
    pub kids: Vec<Node<A>>,
    pub text: String,
    pub click: Option<A>,
}
pub fn el<A>(tag: &'static str) -> Node<A> { Node { tag, key: "", attrs: Vec::new(), kids: Vec::new(), text: String::new(), click: None } }
pub fn text<A>(value: impl Into<String>) -> Node<A> { Node { tag: "", key: "", attrs: Vec::new(), kids: Vec::new(), text: value.into(), click: None } }
impl<A> Node<A> {
    pub fn key(mut self, key: &'static str) -> Self { self.key = key; self }
    pub fn attr(mut self, name: &'static str, value: impl Into<String>) -> Self { self.attrs.push((name, value.into())); self }
    /// A boolean attribute (`disabled`, `hidden`), present only when `on`.
    pub fn flag(self, name: &'static str, on: bool) -> Self { if on { self.attr(name, "") } else { self } }
    pub fn class(self, value: impl Into<String>) -> Self { self.attr("class", value) }
    pub fn id(self, value: &'static str) -> Self { self.attr("id", value) }
    pub fn style(self, value: impl Into<String>) -> Self { self.attr("style", value) }
    pub fn label(self, value: impl Into<String>) -> Self { self.attr("aria-label", value) }
    /// Text content (a text-node child).
    pub fn t(mut self, value: impl Into<String>) -> Self { self.kids.push(text(value)); self }
    pub fn child(mut self, node: Node<A>) -> Self { self.kids.push(node); self }
    pub fn maybe(mut self, node: Option<Node<A>>) -> Self { if let Some(n) = node { self.kids.push(n); } self }
    pub fn children(mut self, nodes: impl IntoIterator<Item = Node<A>>) -> Self { self.kids.extend(nodes); self }
    pub fn on(mut self, action: A) -> Self { self.click = Some(action); self }
    pub fn push(&mut self, node: Node<A>) { self.kids.push(node); }
    #[cfg(test)]
    pub fn get(&self, name: &str) -> Option<&str> { self.attrs.iter().find(|(n, _)| *n == name).map(|(_, v)| v.as_str()) }
    #[cfg(test)]
    pub fn has_class(&self, class: &str) -> bool { self.get("class").is_some_and(|c| c.split_whitespace().any(|x| x == class)) }
    /// Depth-first search (tests).
    #[cfg(test)]
    pub fn find(&self, pred: &dyn Fn(&Node<A>) -> bool) -> Option<&Node<A>> { if pred(self) { return Some(self); } self.kids.iter().find_map(|k| k.find(pred)) }
    #[cfg(test)]
    pub fn all<'a>(&'a self, pred: &dyn Fn(&Node<A>) -> bool, out: &mut Vec<&'a Node<A>>) { if pred(self) { out.push(self); } for k in &self.kids { k.all(pred, out); } }
    /// Concatenated text of the subtree.
    #[cfg(test)]
    pub fn inner_text(&self) -> String { if self.tag.is_empty() { return self.text.clone(); } self.kids.iter().map(|k| k.inner_text()).collect() }
}

// ---------------------------------------------------------------- bridge
#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "env")]
extern "C" {
    fn wf_dom_create(handle: u32, tag_ptr: *const u8, tag_len: u32);
    fn wf_dom_text(handle: u32, ptr: *const u8, len: u32);
    fn wf_dom_attr(handle: u32, name_ptr: *const u8, name_len: u32, value_ptr: *const u8, value_len: u32);
    fn wf_dom_unattr(handle: u32, name_ptr: *const u8, name_len: u32);
    fn wf_dom_insert(parent: u32, child: u32, before: u32);
    fn wf_dom_remove(handle: u32);
    fn wf_dom_listen(handle: u32, type_ptr: *const u8, type_len: u32);
}
#[cfg(target_arch = "wasm32")]
mod sys {
    use super::*;
    pub fn create(h: u32, tag: &str) { unsafe { wf_dom_create(h, tag.as_ptr(), tag.len() as u32) } }
    pub fn text(h: u32, value: &str) { unsafe { wf_dom_text(h, value.as_ptr(), value.len() as u32) } }
    pub fn attr(h: u32, name: &str, value: &str) { unsafe { wf_dom_attr(h, name.as_ptr(), name.len() as u32, value.as_ptr(), value.len() as u32) } }
    pub fn unattr(h: u32, name: &str) { unsafe { wf_dom_unattr(h, name.as_ptr(), name.len() as u32) } }
    pub fn insert(parent: u32, child: u32, before: u32) { unsafe { wf_dom_insert(parent, child, before) } }
    pub fn remove(h: u32) { unsafe { wf_dom_remove(h) } }
    pub fn listen(h: u32, kind: &str) { unsafe { wf_dom_listen(h, kind.as_ptr(), kind.len() as u32) } }
}
#[cfg(not(target_arch = "wasm32"))]
mod sys {
    pub fn create(_: u32, _: &str) {}
    pub fn text(_: u32, _: &str) {}
    pub fn attr(_: u32, _: &str, _: &str) {}
    pub fn unattr(_: u32, _: &str) {}
    pub fn insert(_: u32, _: u32, _: u32) {}
    pub fn remove(_: u32) {}
    pub fn listen(_: u32, _: &str) {}
}
thread_local! { static EVENTS: RefCell<Vec<(u32, f64)>> = const { RefCell::new(Vec::new()) }; }
/// The page calls this for a listened event on element `handle`; `time` is the event timestamp
/// (one click reaches every listening ancestor with the same timestamp, innermost first).
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_dom_event(handle: u32, time: f64) { EVENTS.with(|e| e.borrow_mut().push((handle, time))); }
#[cfg(test)]
pub fn inject_event(handle: u32, time: f64) { EVENTS.with(|e| e.borrow_mut().push((handle, time))); }

// ---------------------------------------------------------------- live tree
struct Live { handle: u32, tag: &'static str, key: &'static str, attrs: Vec<(&'static str, String)>, kids: Vec<Live>, text: String, listening: bool }
/// The elements on the page under `document.body`, and the click action of each.
pub struct Dom<A> { kids: Vec<Live>, actions: HashMap<u32, A>, next: u32 }
impl<A: Clone> Default for Dom<A> { fn default() -> Self { Self::new() } }
impl<A: Clone> Dom<A> {
    pub fn new() -> Self { Self { kids: Vec::new(), actions: HashMap::new(), next: 1 } }
    /// Make the page match `tree` (children of the body, in order).
    pub fn render(&mut self, tree: Vec<Node<A>>) {
        let mut kids = std::mem::take(&mut self.kids);
        self.sync(0, &mut kids, tree);
        self.kids = kids;
    }
    /// Clicks since the last call, innermost element of each click only.
    pub fn take_clicks(&mut self) -> Vec<A> {
        let events = EVENTS.with(|e| std::mem::take(&mut *e.borrow_mut()));
        let mut out = Vec::new();
        let mut last = f64::NAN;
        for (handle, time) in events {
            if time == last { continue; }
            last = time;
            if let Some(a) = self.actions.get(&handle) { out.push(a.clone()); }
        }
        out
    }
    fn create(&mut self, node: Node<A>) -> Live {
        let handle = self.next;
        self.next += 1;
        if node.tag.is_empty() {
            sys::text(handle, &node.text);
            return Live { handle, tag: "", key: node.key, attrs: Vec::new(), kids: Vec::new(), text: node.text, listening: false };
        }
        sys::create(handle, node.tag);
        for (name, value) in &node.attrs { sys::attr(handle, name, value); }
        let listening = node.click.is_some();
        if let Some(a) = node.click { self.actions.insert(handle, a); sys::listen(handle, "click"); }
        let mut kids = Vec::with_capacity(node.kids.len());
        for kid in node.kids { let live = self.create(kid); sys::insert(handle, live.handle, 0); kids.push(live); }
        Live { handle, tag: node.tag, key: node.key, attrs: node.attrs, kids, text: String::new(), listening }
    }
    /// Detach the element, then release every handle of its subtree on the page side.
    fn destroy(&mut self, live: Live) { sys::remove(live.handle); self.release(&live); }
    fn release(&mut self, live: &Live) { self.actions.remove(&live.handle); for k in &live.kids { sys::remove(k.handle); self.release(k); } }
    fn patch(&mut self, live: &mut Live, node: Node<A>) {
        if live.tag.is_empty() {
            if live.text != node.text { sys::text(live.handle, &node.text); live.text = node.text; }
            return;
        }
        for (name, value) in &node.attrs {
            if live.attrs.iter().any(|(n, v)| n == name && v == value) { continue; }
            sys::attr(live.handle, name, value);
        }
        for (name, _) in &live.attrs { if !node.attrs.iter().any(|(n, _)| n == name) { sys::unattr(live.handle, name); } }
        live.attrs = node.attrs;
        match node.click {
            Some(a) => { self.actions.insert(live.handle, a); if !live.listening { sys::listen(live.handle, "click"); live.listening = true; } }
            None => { self.actions.remove(&live.handle); }
        }
        let mut kids = std::mem::take(&mut live.kids);
        self.sync(live.handle, &mut kids, node.kids);
        live.kids = kids;
    }
    fn sync(&mut self, parent: u32, live: &mut Vec<Live>, nodes: Vec<Node<A>>) {
        let count = nodes.len();
        for (i, node) in nodes.into_iter().enumerate() {
            if i < live.len() {
                if live[i].tag == node.tag && live[i].key == node.key { self.patch(&mut live[i], node); continue; }
                let fresh = self.create(node);
                sys::insert(parent, fresh.handle, live[i].handle);
                let old = std::mem::replace(&mut live[i], fresh);
                self.destroy(old);
            } else {
                let fresh = self.create(node);
                sys::insert(parent, fresh.handle, 0);
                live.push(fresh);
            }
        }
        while live.len() > count { let old = live.pop().unwrap(); self.destroy(old); }
    }
    #[cfg(test)]
    pub fn handle_of(&self, pred: &dyn Fn(&'static str, &[(&'static str, String)]) -> bool) -> Option<u32> {
        fn walk(l: &Live, pred: &dyn Fn(&'static str, &[(&'static str, String)]) -> bool) -> Option<u32> { if pred(l.tag, &l.attrs) { return Some(l.handle); } l.kids.iter().find_map(|k| walk(k, pred)) }
        self.kids.iter().find_map(|k| walk(k, pred))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn clicks_resolve_to_the_innermost_listening_element() {
        let mut dom: Dom<&'static str> = Dom::new();
        dom.render(vec![el("div").class("backdrop").on("dismiss").child(el("section").class("panel").on("stay").child(el("button").class("go").on("go").t("Go")))]);
        let panel = dom.handle_of(&|_, a| a.iter().any(|(_, v)| v == "panel")).unwrap();
        let backdrop = dom.handle_of(&|_, a| a.iter().any(|(_, v)| v == "backdrop")).unwrap();
        // One click on the panel bubbles to the backdrop with the same timestamp.
        inject_event(panel, 10.); inject_event(backdrop, 10.);
        inject_event(backdrop, 20.);
        assert_eq!(dom.take_clicks(), vec!["stay", "dismiss"]);
    }
    #[test]
    fn a_removed_action_stops_answering_and_keys_force_fresh_elements() {
        let mut dom: Dom<u8> = Dom::new();
        dom.render(vec![el("button").key("a").on(1).t("One")]);
        let first = dom.handle_of(&|t, _| t == "button").unwrap();
        dom.render(vec![el("button").key("a").t("One")]);
        inject_event(first, 1.);
        assert!(dom.take_clicks().is_empty());
        dom.render(vec![el("button").key("b").on(2).t("Two")]);
        let second = dom.handle_of(&|t, _| t == "button").unwrap();
        assert_ne!(first, second);
        inject_event(second, 2.);
        assert_eq!(dom.take_clicks(), vec![2]);
    }
    #[test]
    fn node_queries_read_text_and_classes() {
        let n: Node<()> = el("div").class("a b").child(el("span").t("Hi ")).child(el("b").t("there"));
        assert!(n.has_class("b") && !n.has_class("c"));
        assert_eq!(n.inner_text(), "Hi there");
        assert!(n.find(&|k| k.tag == "b").is_some());
    }
}
