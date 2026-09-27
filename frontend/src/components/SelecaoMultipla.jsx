import { useState } from 'react';

export default function SelecaoMultipla({ titulo, opcoes, selecionados = [], onChange, disabled = false }) {
  const [busca, setBusca] = useState('');
  const ids = selecionados.map(String);
  const visiveis = opcoes.filter(o => o.label.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')));
  return <fieldset className="multi-links" disabled={disabled}>
    <legend>{titulo}</legend>
    <label className="multi-search">Filtrar opções<input className="form-control" type="search" value={busca} onChange={e => setBusca(e.target.value)} /></label>
    <p>{ids.length} selecionado(s)</p>
    <div className="multi-options">
      {visiveis.map(o => <label key={o.id} className="multi-option"><input type="checkbox" checked={ids.includes(String(o.id))} disabled={o.disabled} onChange={e => onChange(e.target.checked ? [...ids, String(o.id)] : ids.filter(id => id !== String(o.id)))} /><span>{o.label}{o.disabled ? ' (somente consulta)' : ''}</span></label>)}
      {!visiveis.length && <p>Nenhuma opção disponível.</p>}
    </div>
  </fieldset>;
}
