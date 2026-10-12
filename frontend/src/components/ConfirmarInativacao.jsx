import { useEffect, useId, useRef, useState } from 'react';

export default function ConfirmarInativacao({ titulo, pergunta, identificacao, onConfirmar, onCancelar, focoRetorno, rotuloEnvio = 'Inativando…', erroPadrao = 'Não foi possível inativar. Tente novamente.' }) {
  const dialog = useRef(null);
  const trava = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const id = useId();

  useEffect(() => {
    const modal = dialog.current;
    const anterior = document.activeElement;
    const overflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      modal.close();
      document.body.style.overflow = overflow;
      if (anterior?.isConnected && !anterior.disabled) anterior.focus();
      else focoRetorno?.current?.focus();
    };
  }, [focoRetorno]);

  async function confirmar() {
    if (trava.current) return;
    trava.current = true; setEnviando(true); setErro('');
    try { await onConfirmar(); }
    catch (err) { setErro(err.response?.data?.erro || erroPadrao); }
    finally { trava.current = false; setEnviando(false); }
  }

  return <dialog ref={dialog} className="document-delete-dialog" aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-pergunta ${id}-registro`} onCancel={e => e.preventDefault()}>
    <h2 id={`${id}-titulo`}>{titulo}</h2>
    <hr className="divider" />
    <p id={`${id}-pergunta`}>{pergunta}</p>
    <p id={`${id}-registro`} className="document-delete-name"><strong>{identificacao}</strong></p>
    {erro && <div className="alert alert-erro" role="alert">{erro}</div>}
    <div className="form-actions">
      <button type="button" className="btn btn-secondary" autoFocus disabled={enviando} onClick={() => { if (!trava.current) onCancelar(); }}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={enviando} onClick={confirmar}>{enviando ? rotuloEnvio : 'Confirmar'}</button>
    </div>
  </dialog>;
}
