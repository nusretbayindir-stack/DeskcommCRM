import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

import { AvisoDeRiscoDoQr } from "./AvisoDeRiscoDoQr";

afterEach(cleanup);

const botao = (nome = "Continuar") => screen.getByRole<HTMLButtonElement>("button", { name: nome });
const caixa = () => screen.getByRole<HTMLInputElement>("checkbox");

describe("AvisoDeRiscoDoQr", () => {
  it("diz o risco antes do controle: não é o caminho oficial, quem reativa e onde está a cláusula", () => {
    const { container } = render(<AvisoDeRiscoDoQr onContinuar={vi.fn()} />);
    const texto = container.textContent ?? "";

    expect(texto).toContain("Leia: esta conexão não é o caminho oficial da Meta");
    expect(texto).toContain("reativá-lo depende do WhatsApp, não de nós");
    expect(texto).toContain("cláusula 9");
  });

  it("Continuar só libera com a caixa marcada, e volta a travar se desmarcar", () => {
    render(<AvisoDeRiscoDoQr onContinuar={vi.fn()} />);

    expect(botao().disabled).toBe(true);
    fireEvent.click(caixa());
    expect(botao().disabled).toBe(false);
    fireEvent.click(caixa());
    expect(botao().disabled).toBe(true);
  });

  it("clicar em Continuar com a caixa marcada avisa uma vez", () => {
    const continuar = vi.fn();
    render(<AvisoDeRiscoDoQr onContinuar={continuar} />);

    fireEvent.click(caixa());
    fireEvent.click(botao());

    expect(continuar).toHaveBeenCalledTimes(1);
  });

  it("sem a caixa, clicar não avisa", () => {
    const continuar = vi.fn();
    render(<AvisoDeRiscoDoQr onContinuar={continuar} />);

    fireEvent.click(botao());

    expect(continuar).not.toHaveBeenCalled();
  });

  it("em turco", () => {
    const { container } = render(
      <IdiomaProvider locale="tr">
        <AvisoDeRiscoDoQr onContinuar={vi.fn()} />
      </IdiomaProvider>,
    );
    const texto = container.textContent ?? "";

    expect(texto).toContain("Okuyun: Bu bağlantı Meta'nın resmî yolu değildir");
    expect(texto).toContain("sözleşmenizin 9. maddesi");
    expect(texto).toContain("bu numara için riski kabul ediyorum");
    expect(botao("Devam et")).toBeTruthy();
  });
});
