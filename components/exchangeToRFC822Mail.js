/*
 * this file is used to serialize the ExchangeMessage object to RFC822 test
 */
var EXPORTED_SYMBOLS = ["ExchangeToRFC822Mail"];

function mailboxToStr(mailbox) {
  if(!mailbox)  return '';
  return mailbox.name + '<' + mailbox.emailAddress + '>';
}

function ExchangeToRFC822Mail(msg) {
  this.msg = msg;

  // var mailStr = '';
  // if(msg.subject)
  //   mailStr += 'Subject: ' + msg.subject + '\r\n';
  // if(msg.mimeContent)
  //   mailStr += 'Content-Type: ' + msg.mimeContent + '\r\n';
  // if(msg.itemId)
  //   mailStr += 'Message-ID: ' + msg.itemId + '\r\n';
  // if(msg.inReplyTo)
  //   mailStr += 'In-Reply-To: ' + msg.inReplyTo + '\r\n';
  // if(msg.dateTimeSent)
  //   mailStr += 'Date: ' + msg.dateTimeSent + '\r\n';
  // if(msg.from) {
  //   mailStr += 'From: ' + mailboxToStr(msg.from) + '\r\n'
  // }
  // if(msg.toRecipients) {
  //   mailStr += 'To: ' + mailboxToStr(msg.toRecipients) + '\r\n';
  // }
  // if(msg.bodyType) {
  //   mailStr += 'Content-Type: ' + msg.bodyType + ';' + '\r\n\t' +
  //     'charset="' + msg.charset + '"' + '\r\n';
  // }

  // if(msg.body)
  //   mailStr += '\r\n' + msg.body + '\r\n';
  // this.mail = mailStr;
}

ExchangeToRFC822Mail.prototype = {
  getFrom: function() {
    return mailboxToStr(this.msg.from);
  },

  getToRecipients: function() {
    return mailboxToStr(this.msg.toRecipients);
  },

  getSubject: function() {
    return this.msg.subject;
  },

  getMsgId: function() {
    return this.msg.itemId;
  },

  getSentTimeInMilliSeconds: function() {
    return this.msg.dateTimeSent.getTime();
  }
}
