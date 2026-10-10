export const aplicativoComputador = `
Add-Type -AssemblyName System.Windows.Forms
$janela = New-Object System.Windows.Forms.Form
$janela.Text = 'Selene teste de controle nativo'
$janela.Width = 520
$janela.Height = 260
$janela.StartPosition = 'CenterScreen'
$campo = New-Object System.Windows.Forms.TextBox
$campo.AccessibleName = 'Texto de validação'
$campo.SetBounds(30,30,400,30)
$botao = New-Object System.Windows.Forms.Button
$botao.Text = 'Confirmar'
$botao.SetBounds(30,80,200,40)
$botao.Add_Click({ $janela.Text = 'Confirmado: ' + $campo.Text })
$janela.Controls.Add($campo)
$janela.Controls.Add($botao)
$janela.Add_Shown({ [Console]::WriteLine($janela.Handle.ToInt64()); $janela.Activate() })
[System.Windows.Forms.Application]::Run($janela)
`;
