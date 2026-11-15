// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  canaisDoContato, diaNoFuturo, enderecoDeEntrega, instanteDoRecebimento,
  novoPedidoSchema, payloadDoPedidoManual, rotuloDaOrigem,
} from "@/lib/lgpd/pedido-manual";

const BASE = { contact_id: "00000000-0000-4000-8000-000000000001", request_type: "data_request", received_at: "2026-11-15", canal: "whatsapp_registrado" };

describe("o corpo do pedido pela tela", () => {
  it("'outro' sem observação de 10 caracteres é recusado", () => {
    const r = novoPedidoSchema.safeParse({ ...BASE, canal: "outro", observacao: "curta" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["observacao"]);
  });
  it("store_redact não é tipo de pedido pela tela", () => {
    expect(novoPedidoSchema.safeParse({ ...BASE, request_type: "store_redact" }).success).toBe(false);
  });
  it("delivery no corpo é descartado", () => {
    const r = novoPedidoSchema.parse({ ...BASE, delivery: { address: "x@loja.test" } });
    expect(r).not.toHaveProperty("delivery");
  });
});

describe("o dia em que chegou", () => {
  it("aceita hoje em fuso adiantado", () => {
    // 00:30 em Bruxelas = 23:30 UTC do dia anterior
    expect(diaNoFuturo("2026-11-16", new Date("2026-11-15T23:30:00Z"))).toBe(false);
  });
  it("recusa depois de amanhã", () => {
    expect(diaNoFuturo("2026-11-17", new Date("2026-11-15T23:30:00Z"))).toBe(true);
  });
  it("o instante gravado nunca fica no futuro", () => {
    const agora = new Date("2026-11-15T08:00:00Z");
    expect(instanteDoRecebimento("2026-11-15", agora).toISOString()).toBe(agora.toISOString());
    expect(instanteDoRecebimento("2026-11-10", agora).toISOString()).toBe("2026-11-10T12:00:00.000Z");
  });
});

describe("os canais do contato", () => {
  it("só o wa_lid basta para WhatsApp; espaço não é e-mail", () => {
    expect(canaisDoContato({ phone_number: null, wa_lid: "123@lid", email: "  " })).toEqual({ whatsapp: true, email: false });
  });
});

describe("o endereço de entrega", () => {
  it("fixa o e-mail do cadastro no pedido", () => {
    const p = payloadDoPedidoManual({ canal: "email_registrado", observacao: null, criadoPor: "u1", agora: new Date("2026-11-15T08:00:00Z"), emailDoContato: "ana@loja.test" });
    expect(p).toEqual({
      origem_manual: { canal: "email_registrado", observacao: null, criado_por: "u1", criado_em: "2026-11-15T08:00:00.000Z" },
      delivery: { address: "ana@loja.test", origem: "cadastro_no_pedido" },
    });
  });
  it("pedido pela tela não segue o e-mail que mudou depois", () => {
    const p = payloadDoPedidoManual({ canal: "outro", observacao: "veio à loja", criadoPor: "u1", agora: new Date(), emailDoContato: "antigo@loja.test" });
    expect(enderecoDeEntrega(p, "novo@loja.test")).toBe("antigo@loja.test");
  });
  it("pedido pela tela sem e-mail não usa o e-mail incluído depois", () => {
    const p = payloadDoPedidoManual({ canal: "outro", observacao: "veio à loja", criadoPor: "u1", agora: new Date(), emailDoContato: null });
    expect(enderecoDeEntrega(p, "incluido-depois@loja.test")).toBeNull();
  });
  it("pedido da Nuvemshop mantém a regra de antes", () => {
    expect(enderecoDeEntrega({ delivery: null }, "c@loja.test")).toBe("c@loja.test");
    expect(enderecoDeEntrega({ delivery: { address: "p@loja.test" } }, "c@loja.test")).toBe("p@loja.test");
  });
});

it("rótulo da origem", () => {
  expect(rotuloDaOrigem("manual")).toBe("Pelo painel");
  expect(rotuloDaOrigem("nuvemshop")).toBe("Nuvemshop");
  expect(rotuloDaOrigem(null)).toBe("—");
});
