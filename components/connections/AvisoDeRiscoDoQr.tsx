"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";

/**
 * O risco, antes do controle: mesma ordem de `PainelDeChamadaDeVoz`, e sem jargão,
 * porque quem lê é dono de negócio. O aceite vive em memória no chamador; a prova é o
 * audit que o servidor grava ao conectar (`lib/channels/risco-do-qr.ts`). A cláusula
 * citada é a do contrato de serviço: mudou lá, muda aqui e sobe `VERSAO_DO_AVISO_QR`.
 */
export function AvisoDeRiscoDoQr({ onContinuar }: { onContinuar: () => void }) {
  const t = useT();
  const [aceitou, setAceitou] = useState(false);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">{t("Leia: esta conexão não é o caminho oficial da Meta")}</p>
        <p className="mt-1">
          {t(
            "O seu número é conectado pelo WhatsApp do seu celular. O WhatsApp pode considerar isso contrário às regras dele e restringir, bloquear temporariamente ou encerrar definitivamente o número a qualquer momento. Se o número for encerrado, você não consegue receber nem enviar mensagens por ele; reativá-lo depende do WhatsApp, não de nós.",
          )}
        </p>
        <p className="mt-2">
          {t("O sistema reduz esse risco limitando a velocidade de envio, mas não consegue eliminá-lo.")}
        </p>
        <p className="mt-2">
          {t(
            "O número e esse risco são seus. O prestador de serviço não responde pelas consequências, incluindo perda de conversas, contatos ou faturamento (detalhes: cláusula 9 do seu contrato). A conexão oficial da Meta é uma opção à parte; o cadastro na Meta e as taxas dela ficam por sua conta.",
          )}
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={aceitou}
          onChange={(e) => setAceitou(e.target.checked)}
        />
        <span>{t("Li o aviso acima e aceito o risco para este número.")}</span>
      </label>
      {/* Cinza por falta de aceite, condição visível e explicada logo acima. */}
      <Button type="button" size="sm" disabled={!aceitou} onClick={onContinuar}>
        {t("Continuar")}
      </Button>
    </div>
  );
}
